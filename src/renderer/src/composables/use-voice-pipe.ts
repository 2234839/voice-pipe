/**
 * 封装 window.voicePipe IPC 调用的 Vue composable
 * 提供响应式的状态、配置和历史记录
 */
import { ref, readonly } from 'vue'

/** 历史记录条目 */
export interface HistoryEntry {
  /** 识别文本 */
  text: string
  /** 时间戳 (ms) */
  timestamp: number
}

/** 应用状态类型 */
type AppState = 'idle' | 'recording' | 'processing'

/** 当前状态 */
const status = ref<AppState>('idle')

/** 实时识别文本 */
const partialText = ref('')

/** 当前配置 */
const config = ref<Record<string, unknown>>({})

/** 历史记录 */
const history = ref<HistoryEntry[]>([])

/** 是否已初始化 */
let initialized = false

/**
 * 初始化 IPC 监听器
 * 只调用一次，后续调用直接返回
 */
export function useVoicePipe() {
  if (!initialized) {
    initialized = true

    // 监听状态变化
    window.voicePipe.onStatusChange((s: string) => {
      if (s === 'idle' || s === 'recording' || s === 'processing') {
        status.value = s
      }
      // idle 时清空实时文本
      if (s === 'idle') {
        partialText.value = ''
      }
    })

    // 监听实时识别文本
    window.voicePipe.onPartialText((text: string) => {
      partialText.value = text
    })

    // 监听打开设置
    window.voicePipe.onOpenSettings(() => {
      window.dispatchEvent(new CustomEvent('open-settings'))
    })

    // 监听历史记录更新（主进程每次识别完成后推送）
    window.voicePipe.onHistoryUpdate((entry: HistoryEntry) => {
      history.value.unshift(entry)
    })

    // 加载初始配置
    window.voicePipe.getConfig().then(c => {
      config.value = c
    })

    // 加载历史记录
    window.voicePipe.getHistory().then((h: HistoryEntry[]) => {
      history.value = h ?? []
    })
  }

  /** 保存配置 */
  function saveConfig(partial: Record<string, unknown>) {
    Object.assign(config.value, partial)
    window.voicePipe.sendConfigChanged(partial)
  }

  /** 打开开发者工具 */
  function openDevTools() {
    window.voicePipe.openDevTools()
  }

  /** 捕获快捷键 */
  function captureKey(): Promise<string> {
    return new Promise((resolve) => {
      window.voicePipe.startKeyCapture((keyName: string) => {
        window.voicePipe.stopKeyCapture()
        resolve(keyName)
      })
    })
  }

  /** 清空历史记录 */
  function clearHistory() {
    history.value = []
    window.voicePipe.clearHistory()
  }

  /** 获取支持的快捷键列表 */
  function getSupportedHotkeys() {
    return window.voicePipe.getSupportedHotkeys()
  }

  return {
    status: readonly(status),
    partialText: readonly(partialText),
    config: readonly(config),
    history: readonly(history),
    saveConfig,
    openDevTools,
    captureKey,
    clearHistory,
    getSupportedHotkeys,
  }
}
