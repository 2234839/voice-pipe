import WebSocket from 'ws'
import { EventEmitter } from 'events'

/** FunASR 服务端返回的原始消息 */
interface FunASRMessage {
  text: string
  is_final: boolean
  mode: string
}

/**
 * FunASR 流式识别客户端（online 模式）
 * 边发送音频边接收实时识别结果
 *
 * 核心机制：connect() 异步建立 WebSocket 连接，期间 sendChunk() 调用的数据
 * 会被缓存到 pendingChunks 中，连接建立后自动 flush 到服务端
 *
 * 用法：
 *   const client = new AsrStreamClient('ws://127.0.0.1:10095')
 *   client.on('text', (text, isFinal) => { ... })
 *   client.connect()
 *   client.sendChunk(pcmBuffer)
 *   client.finish()
 */
export class AsrStreamClient extends EventEmitter {
  private ws: WebSocket | null = null
  private readonly wsUrl: string
  /** 是否已收到最终结果 */
  private settled = false
  /** 连接建立前缓存的 PCM chunks */
  private pendingChunks: Buffer[] = []

  constructor(wsUrl: string) {
    super()
    this.wsUrl = wsUrl
  }

  /** 连接 FunASR 服务 */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.settled = false
      this.pendingChunks = []

      this.ws = new WebSocket(this.wsUrl)

      this.ws.on('error', (err) => {
        const msg = `FunASR WebSocket 连接失败: ${err.message}`
        console.log(`[asr] ${msg}`)
        reject(new Error(msg))
      })

      this.ws.on('open', () => {
        console.log('[asr] 已连接')

        // 发送控制消息：online 模式
        const controlMsg = JSON.stringify({
          mode: 'online',
          chunk_size: [5, 10, 5],
          chunk_interval: 10,
          encoder_chunk_look_back: 4,
          decoder_chunk_look_back: 0,
          audio_fs: 16000,
          wav_name: 'microphone',
          wav_format: 'pcm',
          is_speaking: true,
          itn: true,
        })
        this.ws!.send(controlMsg)

        // flush 连接建立前缓存的数据
        if (this.pendingChunks.length > 0) {
          console.log(`[asr] flush ${this.pendingChunks.length} 个缓存的 PCM chunks`)
          for (const chunk of this.pendingChunks) {
            this.ws!.send(chunk)
          }
          this.pendingChunks = []
        }

        resolve()
      })

      this.ws.on('message', (data: WebSocket.Data) => {
        const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
        const msg: FunASRMessage = JSON.parse(raw)
        const isFinal = msg.is_final ?? false
        console.log(`[asr] 收到文本 (is_final=${isFinal}): "${msg.text}"`)
        this.emit('text', msg.text ?? '', isFinal)

        if (isFinal) {
          this.settled = true
          this.ws?.close()
        }
      })

      this.ws.on('close', () => {
        if (!this.settled) {
          // 连接关闭但没收到 is_final，发出空结果
          this.emit('text', '', true)
        }
      })
    })
  }

  /** 发送一个 PCM chunk（如果未连接则缓存） */
  sendChunk(chunk: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk)
    } else {
      /** 连接尚未建立，缓存起来等 open 后 flush */
      this.pendingChunks.push(chunk)
    }
  }

  /** 停止说话，发送结束标记 */
  finish(): void {
    // 先 flush 残余缓存
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.pendingChunks.length > 0) {
      for (const chunk of this.pendingChunks) {
        this.ws.send(chunk)
      }
      this.pendingChunks = []
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ is_speaking: false }))
    }
    this.settled = true
  }

  /** 强制关闭连接 */
  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
