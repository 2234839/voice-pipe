/**
 * 音频采集器
 * 使用 Web Audio API + AudioWorklet 采集麦克风音频，实时推送 PCM 数据到主进程
 * 支持波形可视化回调
 *
 * AudioWorklet processor 文件位于 public/pcm-processor.js，
 * Vite 构建时原样拷贝到输出目录，运行时通过相对路径加载
 */

/** 波形数据回调（Float32，-1.0 ~ 1.0） */
export type WaveformCallback = (data: Float32Array) => void

/** PCM chunk 回调（降采样后的 Int16Array） */
export type PcmChunkCallback = (chunk: Int16Array) => void

export class AudioCapture {
  /** 音频上下文 */
  private audioContext: AudioContext | null = null
  /** 媒体流 */
  private mediaStream: MediaStream | null = null
  /** AnalyserNode 用于波形可视化 */
  private analyserNode: AnalyserNode | null = null
  /** 原始数据源节点 */
  private sourceNode: MediaStreamAudioSourceNode | null = null
  /** AudioWorkletNode */
  private workletNode: AudioWorkletNode | null = null
  /** 波形回调 */
  private onWaveform: WaveformCallback | null = null
  /** PCM chunk 回调 */
  private onPcmChunk: PcmChunkCallback | null = null
  /** 波形动画帧 ID */
  private waveformFrameId: number = 0

  /**
   * 设置波形数据回调
   * 录音期间每帧调用，用于可视化
   */
  setWaveformCallback(callback: WaveformCallback): void {
    this.onWaveform = callback
  }

  /**
   * 设置 PCM chunk 回调
   * 每收集到一块降采样后的 PCM 数据就调用，用于实时发送到主进程
   */
  setPcmChunkCallback(callback: PcmChunkCallback): void {
    this.onPcmChunk = callback
  }

  /**
   * 开始录音
   */
  async start(): Promise<void> {
    console.log('[audio] 请求麦克风权限...')

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    console.log('[audio] 麦克风已获取')

    this.audioContext = new AudioContext({ sampleRate: 48000 })

    // AnalyserNode 用于波形可视化
    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = 2048

    // 加载 AudioWorklet processor（与 index.html 同目录，用相对路径）
    await this.audioContext.audioWorklet.addModule('./pcm-processor.js')

    // 创建 AudioWorkletNode
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor')

    // 接收 PCM chunks
    this.workletNode.port.onmessage = (event: MessageEvent) => {
      const chunk: Int16Array = event.data
      this.onPcmChunk?.(chunk)
    }

    // 连接音频图：source → analyser + worklet → destination
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.sourceNode.connect(this.analyserNode)
    this.sourceNode.connect(this.workletNode)
    this.workletNode.connect(this.audioContext.destination)

    // 启动波形动画
    this.startWaveformLoop()

    console.log('[audio] 录音已开始')
  }

  /** 停止录音 */
  stop(): void {
    console.log('[audio] 停止录音')

    cancelAnimationFrame(this.waveformFrameId)
    this.workletNode?.disconnect()
    this.analyserNode?.disconnect()
    this.sourceNode?.disconnect()
    this.mediaStream?.getTracks().forEach(track => track.stop())
    this.audioContext?.close()

    this.workletNode = null
    this.analyserNode = null
    this.sourceNode = null
    this.mediaStream = null
    this.audioContext = null
  }

  /** 波形动画循环 */
  private startWaveformLoop(): void {
    const draw = () => {
      if (!this.analyserNode || !this.audioContext) return

      const bufferLength = this.analyserNode.frequencyBinCount
      const dataArray = new Float32Array(bufferLength)
      this.analyserNode.getFloatTimeDomainData(dataArray)

      this.onWaveform?.(dataArray)
      this.waveformFrameId = requestAnimationFrame(draw)
    }
    draw()
  }
}
