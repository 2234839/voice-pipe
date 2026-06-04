import { AudioCapture } from './audio-capture'
import { initSettings } from './settings'

/** 音频采集器实例 */
const audioCapture = new AudioCapture()

/** 波形 canvas */
let canvas: HTMLCanvasElement | null = null
let canvasCtx: CanvasRenderingContext2D | null = null

/** 初始化 */
function init(): void {
  // 波形 canvas
  canvas = document.getElementById('visualizer-canvas') as HTMLCanvasElement
  canvasCtx = canvas?.getContext('2d') ?? null

  // 音频回调
  audioCapture.setWaveformCallback((data) => {
    drawWaveform(data)
    // 转发波形数据给主进程，由主进程转发给指示器窗口
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
  const indicator = document.getElementById('status-indicator')
  const text = document.getElementById('status-text')
  const visualizer = document.getElementById('visualizer')

  if (!indicator || !text) return

  indicator.className = `status-${status}`

  const statusTexts: Record<string, string> = {
    idle: '就绪 — 按住快捷键开始说话',
    recording: '录音中...',
    processing: '识别中...',
  }
  text.textContent = statusTexts[status] ?? status

  if (visualizer) {
    visualizer.classList.toggle('hidden', status !== 'recording')
  }

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

/** 绘制波形 */
function drawWaveform(data: Float32Array): void {
  if (!canvas || !canvasCtx) return

  // 自适应 canvas 尺寸
  const parent = canvas.parentElement
  if (parent) {
    canvas.width = parent.clientWidth
    canvas.height = parent.clientHeight
  }

  const width = canvas.width
  const height = canvas.height

  canvasCtx.clearRect(0, 0, width, height)
  canvasCtx.lineWidth = 2
  canvasCtx.strokeStyle = '#4ecca3'
  canvasCtx.beginPath()

  const sliceWidth = width / data.length
  let x = 0

  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    const y = (v * 0.5 + 0.5) * height
    if (i === 0) {
      canvasCtx.moveTo(x, y)
    } else {
      canvasCtx.lineTo(x, y)
    }
    x += sliceWidth
  }

  canvasCtx.lineTo(width, height / 2)
  canvasCtx.stroke()
}

/** 切换设置面板 */
function toggleSettings(show: boolean): void {
  const panel = document.getElementById('settings-panel')
  if (panel) {
    panel.classList.toggle('hidden', !show)
  }
}

init()
