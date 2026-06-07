import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'
import { AsrStreamClient } from './asr-client'
import type { HotwordEntry } from './config'

/** 获取主窗口的辅助函数（由 index.ts 注册） */
let getMainWindow: (() => BrowserWindow | null) = () => null

/** 注册获取主窗口的方法（在 index.ts 中调用） */
export function initAlwaysOn(windowGetter: () => BrowserWindow | null): void {
  getMainWindow = windowGetter
}

/** 全天候监听记录 */
interface AlwaysOnRecord {
  /** 识别文本 */
  text: string
  /** 时间戳 (ms) */
  timestamp: number
}

/** 全天候 ASR 客户端 */
let alwaysOnClient: AsrStreamClient | null = null

/** 诊断：记录是否曾发送过 PCM */
let hasEverSentChunk = false

/** 全天候模式是否运行中 */
let isActive = false

/** 获取当前是否活跃 */
export function isAlwaysOnActive(): boolean {
  return isActive
}

/** 获取记录存储目录 */
function getRecordsDir(): string {
  return join(app.getPath('userData'), 'voice-records')
}

/** 获取今天的 JSONL 文件路径 */
function getTodayFilePath(): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return join(getRecordsDir(), `${dateStr}.jsonl`)
}

/** 追加一条记录到今天的 JSONL 文件 */
function appendRecord(text: string): void {
  const dir = getRecordsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const record: AlwaysOnRecord = {
    text,
    timestamp: Date.now(),
  }

  const filePath = getTodayFilePath()
  appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf-8')
  console.log(`[always-on] 记录已保存: "${text.slice(0, 30)}..."`)
}

/** 启动全天候监听 */
export function startAlwaysOn(asrUrl: string, hotwords: HotwordEntry[] = []): void {
  if (isActive) return

  console.log('[always-on] 启动全天候监听')

  hasEverSentChunk = false
  alwaysOnClient = new AsrStreamClient(asrUrl, hotwords, true)

  alwaysOnClient.on('text', (text: string, isFinal: boolean, mode: string) => {
    if (!text) return
    // text 事件用于实时显示（可选）
  })

  alwaysOnClient.on('segment', (text: string, _mode: string) => {
    // 服务端 VAD 检测到一段结束，保存记录
    if (text && text.trim()) {
      appendRecord(text.trim())
    }
  })

  isActive = true

  // 通知渲染进程开始麦克风采集
  getMainWindow()?.webContents.send('start-always-on-cmd')

  alwaysOnClient.connect().then(() => {
    console.log('[always-on] ASR 连接已建立')
  }).catch((err: Error) => {
    console.log(`[always-on] ASR 连接失败: ${err.message}`)
    // 连接失败时重试
    isActive = false
    alwaysOnClient = null
    setTimeout(() => {
      if (!isActive) {
        console.log('[always-on] 5秒后重试连接...')
        startAlwaysOn(asrUrl, hotwords)
      }
    }, 5000)
  })
}

/** 停止全天候监听 */
export function stopAlwaysOn(): void {
  if (!isActive) return

  console.log('[always-on] 停止全天候监听')
  isActive = false

  // 通知渲染进程停止麦克风采集
  getMainWindow()?.webContents.send('stop-always-on-cmd')

  if (alwaysOnClient) {
    alwaysOnClient.close()
    alwaysOnClient = null
  }
}

/** 转发 PCM chunk 给全天候 ASR 客户端 */
export function sendAlwaysOnChunk(data: Buffer): void {
  if (!isActive || !alwaysOnClient) return

  if (!hasEverSentChunk) {
    hasEverSentChunk = true
    console.log(`[always-on] 首次转发 PCM: ${data.length} bytes, client=${alwaysOnClient ? 'exists' : 'null'}`)
  }

  const STRIDE = 1920
  for (let offset = 0; offset < data.length; offset += STRIDE) {
    const sub = data.subarray(offset, Math.min(offset + STRIDE, data.length))
    alwaysOnClient.sendChunk(sub)
  }
}
