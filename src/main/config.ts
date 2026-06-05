import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

/** 热词条目 */
export interface HotwordEntry {
  /** 热词文本 */
  word: string
  /** 权重 (1-100) */
  weight: number
}

/** 应用配置 */
interface AppConfig {
  /** ASR 服务 WebSocket 地址 */
  asrUrl: string
  /** 是否显示通知 */
  notification: boolean
  /** 快捷键键码 */
  hotkey: string
  /** 热词列表 */
  hotwords: HotwordEntry[]
  /** 全天候监听模式 */
  alwaysOn: boolean
}

/** 配置默认值 */
const defaults: AppConfig = {
  asrUrl: 'ws://127.0.0.1:10095',
  notification: true,
  hotkey: 'RightAlt',
  hotwords: [],
  alwaysOn: false,
}

/** 配置文件路径 */
function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

/** 内存中的配置缓存 */
let cachedConfig: AppConfig | null = null

/** 从磁盘读取配置，合并默认值 */
function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return { ...defaults }
  }
  const raw = readFileSync(configPath, 'utf-8')
  const saved = JSON.parse(raw) as Partial<AppConfig>
  return { ...defaults, ...saved }
}

/** 确保配置已加载 */
function ensureLoaded(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig()
  }
  return cachedConfig
}

/** 将配置写入磁盘 */
function saveConfig(config: AppConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

/** 获取完整配置 */
export function getConfig(): AppConfig {
  return { ...ensureLoaded() }
}

/** 更新配置项 */
export function updateConfig(partial: Partial<AppConfig>): void {
  const config = ensureLoaded()
  console.log(`[config] 更新前 hotwords: ${JSON.stringify(config.hotwords)}`)
  Object.assign(config, partial)
  console.log(`[config] 更新后 hotwords: ${JSON.stringify(config.hotwords)}`)
  saveConfig(config)
}

/** 获取单个配置项 */
export function get<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return ensureLoaded()[key]
}
