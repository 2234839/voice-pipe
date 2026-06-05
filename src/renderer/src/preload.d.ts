/** 历史记录条目 */
export interface HistoryEntry {
  /** 识别文本 */
  text: string
  /** 时间戳 (ms) */
  timestamp: number
}

/** preload 暴露的 IPC 接口类型声明 */
export interface VoicePipeAPI {
  /** 主进程通知开始录音 */
  onStartRecording: (callback: () => void) => void
  /** 主进程通知停止录音 */
  onStopRecording: (callback: () => void) => void
  /** 渲染进程发送 PCM 音频块 */
  sendAudioChunk: (chunk: ArrayBuffer) => void
  /** 渲染进程发送完整 PCM 数据 */
  sendCompletePcm: (data: ArrayBuffer) => void
  /** 主进程通知打开设置 */
  onOpenSettings: (callback: () => void) => void
  /** 渲染进程通知配置变更 */
  sendConfigChanged: (config: Record<string, unknown>) => void
  /** 获取当前配置 */
  getConfig: () => Promise<Record<string, unknown>>
  /** 主进程推送状态变化 */
  onStatusChange: (callback: (status: string) => void) => void
  /** 打开开发者工具 */
  openDevTools: () => Promise<void>
  /** 开始捕获按键（用于自定义快捷键） */
  startKeyCapture: (callback: (keyName: string) => void) => void
  /** 停止捕获按键 */
  stopKeyCapture: () => void
  /** 获取支持的快捷键列表 */
  getSupportedHotkeys: () => Promise<string[]>
  /** 主进程推送实时识别文本 */
  onPartialText: (callback: (text: string) => void) => void
  /** 渲染进程发送波形数据（用于指示器窗口可视化） */
  sendWaveformData: (data: number[]) => void
  /** 获取历史记录 */
  getHistory: () => Promise<HistoryEntry[]>
  /** 清空历史记录 */
  clearHistory: () => void
  /** 主进程推送历史更新 */
  onHistoryUpdate: (callback: (entry: HistoryEntry) => void) => void
}

/** 指示器窗口 preload 暴露的接口 */
export interface IndicatorAPI {
  /** 接收波形数据 */
  onWaveformData: (callback: (data: number[]) => void) => void
  /** 接收状态变化 */
  onStatusChange: (callback: (status: string) => void) => void
}

declare global {
  interface Window {
    voicePipe: VoicePipeAPI
    indicator: IndicatorAPI
  }
}
