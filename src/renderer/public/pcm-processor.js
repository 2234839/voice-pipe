/**
 * PCM AudioWorklet Processor
 * 将 48kHz Float32 降采样到 16kHz，并转换 Float32 → Int16
 * 每积累 480 个样本（30ms @16kHz）发送一次
 */
class PcmProcessor extends AudioWorkletProcessor {
  /** 降采样比率 (48000 / 16000 = 3) */
  static get DOWNSAMPLE_RATIO() { return 3 }

  /** 每次发送的样本数 (480 = 30ms @16kHz) */
  static get CHUNK_SIZE() { return 480 }

  constructor() {
    super()
    this.buffer = new Int16Array(0)
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const channelData = input[0]
    if (!channelData || channelData.length === 0) return true

    // 降采样：每3个样本取1个
    const ratio = PcmProcessor.DOWNSAMPLE_RATIO
    const downsampledLength = Math.floor(channelData.length / ratio)
    const int16Data = new Int16Array(downsampledLength)
    for (let i = 0; i < downsampledLength; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i * ratio]))
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // 追加到缓冲区
    const newBuffer = new Int16Array(this.buffer.length + int16Data.length)
    newBuffer.set(this.buffer)
    newBuffer.set(int16Data, this.buffer.length)
    this.buffer = newBuffer

    // 积累够一个 chunk 就发送
    const chunkSize = PcmProcessor.CHUNK_SIZE
    while (this.buffer.length >= chunkSize) {
      const chunk = this.buffer.slice(0, chunkSize)
      this.port.postMessage(chunk, [chunk.buffer])
      this.buffer = this.buffer.slice(chunkSize)
    }

    return true
  }
}

registerProcessor('pcm-processor', PcmProcessor)
