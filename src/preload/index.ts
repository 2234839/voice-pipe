import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('voicePipe', {
  /** 主进程通知开始录音 */
  onStartRecording: (callback: () => void) =>
    ipcRenderer.on('start-recording-cmd', () => callback()),

  /** 主进程通知停止录音 */
  onStopRecording: (callback: () => void) =>
    ipcRenderer.on('stop-recording-cmd', () => callback()),

  /** 渲染进程发送 PCM 音频块 */
  sendAudioChunk: (chunk: ArrayBuffer) =>
    ipcRenderer.send('audio-chunk', chunk),

  /** 渲染进程发送完整 PCM 数据 */
  sendCompletePcm: (data: ArrayBuffer) =>
    ipcRenderer.send('complete-pcm', data),

  /** 主进程通知打开设置 */
  onOpenSettings: (callback: () => void) =>
    ipcRenderer.on('open-settings', () => callback()),

  /** 渲染进程通知配置变更 */
  sendConfigChanged: (config: Record<string, unknown>) =>
    ipcRenderer.send('config-changed', config),

  /** 获取当前配置 */
  getConfig: () =>
    ipcRenderer.invoke('get-config'),

  /** 主进程推送状态变化 */
  onStatusChange: (callback: (status: string) => void) =>
    ipcRenderer.on('status-change', (_event, status: string) => callback(status)),

  /** 打开开发者工具 */
  openDevTools: () =>
    ipcRenderer.invoke('open-dev-tools'),

  /** 开始捕获按键（用于自定义快捷键） */
  startKeyCapture: (callback: (keyName: string) => void) => {
    ipcRenderer.on('key-captured', (_event, keyName: string) => callback(keyName))
    ipcRenderer.send('start-key-capture')
  },

  /** 停止捕获按键 */
  stopKeyCapture: () =>
    ipcRenderer.send('stop-key-capture'),

  /** 获取支持的快捷键列表 */
  getSupportedHotkeys: () =>
    ipcRenderer.invoke('get-supported-hotkeys'),

  /** 主进程推送实时识别文本 */
  onPartialText: (callback: (text: string) => void) =>
    ipcRenderer.on('partial-text', (_event, text: string) => callback(text)),

  /** 渲染进程发送波形数据（用于指示器窗口可视化） */
  sendWaveformData: (data: number[]) =>
    ipcRenderer.send('waveform-data', data),
})
