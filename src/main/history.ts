import { app, BrowserWindow } from 'electron'
import { readFileSync, appendFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'

/** 历史记录条目 */
export interface HistoryEntry {
  /** 识别文本 */
  text: string
  /** 时间戳 (ms) */
  timestamp: number
}

/** 历史记录目录 */
function getHistoryDir(): string {
  return join(app.getPath('userData'), 'history')
}

/** 获取今天的 JSONL 文件名 */
function getTodayFileName(): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `${dateStr}.jsonl`
}

/** 从 JSONL 文件中读取所有记录（最新的在前面） */
function readJsonl(filePath: string): HistoryEntry[] {
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf-8')
  const entries: HistoryEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line) as HistoryEntry)
    } catch {
      // 跳过损坏的行
    }
  }
  // 最新的在前面
  entries.reverse()
  return entries
}

/** 获取所有历史文件（按日期倒序） */
function getHistoryFiles(): string[] {
  const dir = getHistoryDir()
  if (!existsSync(dir)) return []
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse()
  return files.map(f => join(dir, f))
}

/** 获取历史记录（从所有 JSONL 文件中读取，最新的在前面） */
export function getHistory(): HistoryEntry[] {
  const files = getHistoryFiles()
  const all: HistoryEntry[] = []
  for (const file of files) {
    all.push(...readJsonl(file))
  }
  return all
}

/** 添加一条历史记录 */
export function addHistoryEntry(text: string, mainWindow: BrowserWindow | null): void {
  const dir = getHistoryDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const entry: HistoryEntry = {
    text,
    timestamp: Date.now(),
  }

  const filePath = join(dir, getTodayFileName())
  appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8')

  // 推送给渲染进程
  mainWindow?.webContents.send('history-update', entry)
}

/** 清空历史记录 */
export function clearHistory(): void {
  const files = getHistoryFiles()
  for (const file of files) {
    unlinkSync(file)
  }
}
