import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

/** 历史记录条目 */
export interface HistoryEntry {
  /** 识别文本 */
  text: string
  /** 时间戳 (ms) */
  timestamp: number
}

/** 最大历史记录数量 */
const MAX_HISTORY = 100

/** 历史记录文件路径 */
function getHistoryPath(): string {
  return join(app.getPath('userData'), 'history.json')
}

/** 内存中的历史记录缓存 */
let cachedHistory: HistoryEntry[] | null = null

/** 加载历史记录 */
function loadHistory(): HistoryEntry[] {
  const historyPath = getHistoryPath()
  if (!existsSync(historyPath)) {
    return []
  }
  const raw = readFileSync(historyPath, 'utf-8')
  return JSON.parse(raw) as HistoryEntry[]
}

/** 保存历史记录到磁盘 */
function saveHistory(history: HistoryEntry[]): void {
  writeFileSync(getHistoryPath(), JSON.stringify(history, null, 2), 'utf-8')
}

/** 获取历史记录 */
export function getHistory(): HistoryEntry[] {
  if (!cachedHistory) {
    cachedHistory = loadHistory()
  }
  return [...cachedHistory]
}

/** 添加一条历史记录 */
export function addHistoryEntry(text: string, mainWindow: BrowserWindow | null): void {
  if (!cachedHistory) {
    cachedHistory = loadHistory()
  }

  const entry: HistoryEntry = {
    text,
    timestamp: Date.now(),
  }

  // 最新的在最前面
  cachedHistory.unshift(entry)

  // 限制数量
  if (cachedHistory.length > MAX_HISTORY) {
    cachedHistory = cachedHistory.slice(0, MAX_HISTORY)
  }

  saveHistory(cachedHistory)

  // 推送给渲染进程
  mainWindow?.webContents.send('history-update', entry)
}

/** 清空历史记录 */
export function clearHistory(): void {
  cachedHistory = []
  saveHistory([])
}
