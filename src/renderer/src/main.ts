import { AudioCapture } from './audio-capture'
import { initSettings } from './settings'

/** 音频采集器实例 */
const audioCapture = new AudioCapture()

/** 初始化 */
function init(): void {
  // 波形数据转发给指示器窗口（不在主窗口绘制）
  audioCapture.setWaveformCallback((data) => {
    window.voicePipe.sendWaveformData(Array.from(data))
  })

  audioCapture.setPcmChunkCallback((chunk) => {
    // 实时推送每个 PCM chunk 到主进程
    const buf = new ArrayBuffer(chunk.byteLength)
    new Int16Array(buf).set(chunk)
    window.voicePipe.sendAudioChunk(buf)
  })

  // 监听主进程指令
  window.voicePipe.onStartRecording(() => {
    console.log('[renderer] 开始录音')
    audioCapture.start()
    updateStatus('recording')
  })

  window.voicePipe.onStopRecording(() => {
    console.log('[renderer] 停止录音')
    audioCapture.stop()
    window.voicePipe.sendAudioChunk(new ArrayBuffer(0)) // 发送空 buffer 作为结束标记
    updateStatus('processing')
  })

  window.voicePipe.onStatusChange((status: string) => {
    updateStatus(status)
  })

  // 监听主进程推送的实时识别文本
  window.voicePipe.onPartialText((text: string) => {
    updatePartialText(text)
  })

  window.voicePipe.onOpenSettings(() => {
    toggleSettings(true)
  })

  initSettings()
}

/** 更新状态显示 */
function updateStatus(status: string): void {
  const indicatorEl = document.getElementById('status-indicator')
  const text = document.getElementById('status-text')

  if (!indicatorEl || !text) return

  indicatorEl.className = `status-${status}`

  const statusTexts: Record<string, string> = {
    idle: '就绪 — 按住快捷键开始说话',
    recording: '录音中...',
    processing: '识别中...',
  }
  text.textContent = statusTexts[status] ?? status

  // idle 时清空实时文本并隐藏
  if (status === 'idle') {
    const partialEl = document.getElementById('partial-text')
    const partialContainer = document.getElementById('partial-text-container')
    if (partialEl) partialEl.textContent = ''
    if (partialContainer) partialContainer.classList.add('hidden')
  }
}

/** 更新实时识别文本 */
function updatePartialText(text: string): void {
  const container = document.getElementById('partial-text-container')
  const partialEl = document.getElementById('partial-text')
  if (container) {
    container.classList.toggle('hidden', !text)
  }
  if (partialEl) {
    partialEl.textContent = text
  }
}

/** 切换设置面板 */
function toggleSettings(show: boolean): void {
  const panel = document.getElementById('settings-panel')
  if (panel) {
    panel.classList.toggle('hidden', !show)
  }
}

init()
