/**
 * PCM AudioWorklet Processor
 * 将 48kHz Float32 降采样到 16kHz，并转换 Float32 → Int16
 * 每积累 480 个样本（30ms @16kHz）发送一次
 */
class PcmProcessor extends AudioWorkletProcessor {
  /** 降采样比率 (48000 / 16000 = 3) */
  private static readonly DOWNSAMPLE_RATIO = 3

  /** 每次发送的样本数 (480 = 30ms @16kHz) */
  private static readonly CHUNK_SIZE = 480

  /** 缓冲区 */
  private buffer: Int16Array = new Int16Array(0)

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const channelData = input[0]
    if (!channelData || channelData.length === 0) return true

    // 降采样：每3个样本取1个
    const downsampledLength = Math.floor(channelData.length / PcmProcessor.DOWNSAMPLE_RATIO)
    const downsampled = new Float32Array(downsampledLength)
    for (let i = 0; i < downsampledLength; i++) {
      downsampled[i] = channelData[i * PcmProcessor.DOWNSAMPLE_RATIO]
    }

    // Float32 → Int16
    const int16Data = new Int16Array(downsampledLength)
    for (let i = 0; i < downsampledLength; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]))
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // 追加到缓冲区
    const newBuffer = new Int16Array(this.buffer.length + int16Data.length)
    newBuffer.set(this.buffer)
    newBuffer.set(int16Data, this.buffer.length)
    this.buffer = newBuffer

    // 积累够一个 chunk 就发送
    while (this.buffer.length >= PcmProcessor.CHUNK_SIZE) {
      const chunk = this.buffer.slice(0, PcmProcessor.CHUNK_SIZE)
      this.port.postMessage(chunk, [chunk.buffer])
      this.buffer = this.buffer.slice(PcmProcessor.CHUNK_SIZE)
    }

    return true
  }
}

registerProcessor('pcm-processor', PcmProcessor)
