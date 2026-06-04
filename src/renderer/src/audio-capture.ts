/**
 * 音频采集器
 * 使用 Web Audio API + AudioWorklet 采集麦克风音频
 * PCM 和波形数据都从 AudioWorklet 的 process() 回调中产生，
 * 运行在音频线程，不受主窗口后台节流影响
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
  /** 原始数据源节点 */
  private sourceNode: MediaStreamAudioSourceNode | null = null
  /** AudioWorkletNode */
  private workletNode: AudioWorkletNode | null = null
  /** 波形回调 */
  private onWaveform: WaveformCallback | null = null
  /** PCM chunk 回调 */
  private onPcmChunk: PcmChunkCallback | null = null

  /**
   * 设置波形数据回调
   * 录音期间约 30fps 调用，用于可视化
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

    // 加载 AudioWorklet processor（与 index.html 同目录，用相对路径）
    await this.audioContext.audioWorklet.addModule('./pcm-processor.js')

    // 创建 AudioWorkletNode
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor')

    // 接收 PCM chunks 和波形数据
    this.workletNode.port.onmessage = (event: MessageEvent) => {
      const msg = event.data
      if (msg.type === 'pcm') {
        this.onPcmChunk?.(msg.data)
      } else if (msg.type === 'waveform') {
        this.onWaveform?.(msg.data)
      }
    }

    // 连接音频图：source → worklet → destination
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.sourceNode.connect(this.workletNode)
    this.workletNode.connect(this.audioContext.destination)

    console.log('[audio] 录音已开始')
  }

  /** 停止录音 */
  stop(): void {
    console.log('[audio] 停止录音')

    this.workletNode?.disconnect()
    this.sourceNode?.disconnect()
    this.mediaStream?.getTracks().forEach(track => track.stop())
    this.audioContext?.close()

    this.workletNode = null
    this.sourceNode = null
    this.mediaStream = null
    this.audioContext = null
  }
}
