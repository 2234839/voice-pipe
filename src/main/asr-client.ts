import WebSocket from 'ws'
import { EventEmitter } from 'events'
import type { HotwordEntry } from './config'

/** FunASR 服务端返回的原始消息 */
interface FunASRMessage {
  text: string
  is_final: boolean
  mode: string
}

/**
 * 清理 SenseVoiceSmall 模型输出中的特殊标签
 * 如 <|zh|><|NEUTRAL|><|Speech|> 等语言/情感/事件标记
 */
function cleanSenseVoiceTags(text: string): string {
  return text.replace(/<\|[^|]*\|>/g, '')
}

/**
 * FunASR 流式识别客户端（2pass 模式）
 *
 * 普通模式: is_final 后自动关闭连接，用于热键录音
 * 持久模式: is_final 后保持连接继续接收下一段，用于全天候监听
 */
export class AsrStreamClient extends EventEmitter {
  private ws: WebSocket | null = null
  private readonly wsUrl: string
  /** 热词列表 */
  private readonly hotwords: HotwordEntry[]
  /** 持久模式：is_final 后不关闭连接，继续接收下一段 */
  private readonly persistent: boolean
  /** 是否已收到最终结果 */
  private settled = false
  /** 连接建立前缓存的 PCM chunks */
  private pendingChunks: Buffer[] = []
  /** finish() 后等待服务端 is_final=true 的 resolve 回调 */
  private finalResolve: (() => void) | null = null

  constructor(wsUrl: string, hotwords: HotwordEntry[] = [], persistent = false) {
    super()
    this.wsUrl = wsUrl
    this.hotwords = hotwords
    this.persistent = persistent
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
        console.log(`[asr] 已连接 (persistent=${this.persistent})`)

        /** 序列化热词为 FunASR 要求的 JSON 字符串格式 */
        const hotwordsStr = this.hotwords.length > 0
          ? JSON.stringify(Object.fromEntries(this.hotwords.map(h => [h.word, h.weight])))
          : ''

        const controlMsg = JSON.stringify({
          mode: '2pass',
          chunk_size: [5, 10, 5],
          chunk_interval: 10,
          encoder_chunk_look_back: 4,
          decoder_chunk_look_back: 0,
          audio_fs: 16000,
          wav_name: 'microphone',
          wav_format: 'pcm',
          is_speaking: true,
          itn: true,
          hotwords: hotwordsStr,
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
        let msg: FunASRMessage
        try {
          msg = JSON.parse(raw)
        } catch {
          console.log(`[asr] 非JSON消息: ${raw.slice(0, 100)}`)
          return
        }
        const isFinal = msg.is_final ?? false
        const mode = msg.mode ?? ''
        const cleaned = cleanSenseVoiceTags(msg.text ?? '')
        console.log(`[asr] 收到文本 (mode=${mode}, is_final=${isFinal}): "${cleaned}"`)
        this.emit('text', cleaned, isFinal, mode)

        if (isFinal) {
          if (this.persistent) {
            // 持久模式：emit segment 事件，重置状态继续等待下一段
            this.emit('segment', cleaned, mode)
            this.settled = false
          } else {
            this.settled = true
            // 通知 waitForFinal() 的等待者
            this.finalResolve?.()
            this.finalResolve = null
            this.ws?.close()
          }
        }
      })

      this.ws.on('close', () => {
        if (!this.settled) {
          this.emit('text', '', true)
        }
        // 确保 waitForFinal() 不会永远挂起
        this.finalResolve?.()
        this.finalResolve = null
      })
    })
  }

  /** 发送一个 PCM chunk（如果未连接则缓存） */
  sendChunk(chunk: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk)
    } else {
      this.pendingChunks.push(chunk)
    }
  }

  /** 停止说话，发送结束标记 */
  finish(): void {
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

  /**
   * 等待服务端返回 is_final=true（即 2pass 最终纠错完成）
   * 必须在 finish() 之后调用，最多等待 timeout 毫秒
   */
  waitForFinal(timeout = 5000): Promise<void> {
    if (this.settled && this.ws?.readyState !== WebSocket.OPEN) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.finalResolve = null
        resolve()
      }, timeout)
      this.finalResolve = () => {
        clearTimeout(timer)
        resolve()
      }
    })
  }

  /** 强制关闭连接 */
  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
