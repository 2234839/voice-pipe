/**
 * PCM AudioWorklet Processor
 * 将 48kHz Float32 降采样到 16kHz，并转换 Float32 → Int16
 * 每积累 480 个样本（30ms @16kHz）发送一次 PCM chunk
 * 同时每 ~33ms 发送一次波形可视化数据（Float32Array）
 */
class PcmProcessor extends AudioWorkletProcessor {
  /** 降采样比率 (48000 / 16000 = 3) */
  static get DOWNSAMPLE_RATIO() { return 3 }

  /** 每次发送的 PCM 样本数 (480 = 30ms @16kHz) */
  static get CHUNK_SIZE() { return 480 }

  /** 波形数据发送间隔（约 20fps，每 15 帧发送一次） */
  static get WAVEFORM_FRAMES() { return 15 }

  constructor() {
    super()
    /** PCM 缓冲区 */
    this.pcmBuffer = new Int16Array(0)
    /** 波形帧计数器 */
    this.waveformFrameCount = 0
    /** 波形数据缓冲（累积原始 Float32 用于可视化） */
    this.waveformAccumulator = []
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const channelData = input[0]
    if (!channelData || channelData.length === 0) return true

    // === PCM 降采样 + 发送 ===
    const ratio = PcmProcessor.DOWNSAMPLE_RATIO
    const downsampledLength = Math.floor(channelData.length / ratio)
    const int16Data = new Int16Array(downsampledLength)
    for (let i = 0; i < downsampledLength; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i * ratio]))
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // 追加到 PCM 缓冲区
    const newBuffer = new Int16Array(this.pcmBuffer.length + int16Data.length)
    newBuffer.set(this.pcmBuffer)
    newBuffer.set(int16Data, this.pcmBuffer.length)
    this.pcmBuffer = newBuffer

    // 积累够一个 chunk 就发送
    const chunkSize = PcmProcessor.CHUNK_SIZE
    while (this.pcmBuffer.length >= chunkSize) {
      const chunk = this.pcmBuffer.slice(0, chunkSize)
      this.port.postMessage({ type: 'pcm', data: chunk }, [chunk.buffer])
      this.pcmBuffer = this.pcmBuffer.slice(chunkSize)
    }

    // === 波形可视化数据 ===
    // 每帧累积原始音频数据，每 10 帧发送一次
    this.waveformAccumulator.push(new Float32Array(channelData))
    this.waveformFrameCount++

    if (this.waveformFrameCount >= PcmProcessor.WAVEFORM_FRAMES) {
      // 降采样波形：从累积数据中均匀取 64 个样本
      const totalSamples = this.waveformAccumulator.reduce((sum, arr) => sum + arr.length, 0)
      const WAVEFORM_SAMPLES = 64
      const step = totalSamples / WAVEFORM_SAMPLES
      const waveform = new Float32Array(WAVEFORM_SAMPLES)

      // 把所有累积帧合并后降采样
      let sampleIdx = 0
      for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
        const targetPos = Math.floor(i * step)
        // 找到 targetPos 对应的累积数组中的位置
        let offset = targetPos
        for (const arr of this.waveformAccumulator) {
          if (offset < arr.length) {
            waveform[i] = arr[offset]
            break
          }
          offset -= arr.length
        }
      }

      this.port.postMessage({ type: 'waveform', data: waveform })
      this.waveformAccumulator = []
      this.waveformFrameCount = 0
    }

    return true
  }
}

registerProcessor('pcm-processor', PcmProcessor)
