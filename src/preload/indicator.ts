import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('indicator', {
  /** 接收波形数据 */
  onWaveformData: (callback: (data: number[]) => void) =>
    ipcRenderer.on('waveform-data', (_event, data: number[]) => callback(data)),

  /** 接收状态变化 */
  onStatusChange: (callback: (status: string) => void) =>
    ipcRenderer.on('indicator-status', (_event, status: string) => callback(status)),

  /** 接收实时识别文本 */
  onPartialText: (callback: (text: string) => void) =>
    ipcRenderer.on('indicator-partial-text', (_event, text: string) => callback(text)),
})
