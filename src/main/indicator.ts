import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

/** 指示器窗口实例 */
let indicatorWindow: BrowserWindow | null = null

/** 创建计数器（调试用） */
let createCount = 0

/** 显示录音指示器窗口 */
export function showIndicator(): void {
  createCount++
  console.log(`[indicator] showIndicator 调用 #${createCount}, 现有窗口: ${indicatorWindow ? '存在(id=' + indicatorWindow.id + ')' : 'null'}`)

  if (indicatorWindow) {
    console.log('[indicator] 窗口已存在，跳过创建')
    return
  }

  console.log('[indicator] 创建指示器窗口')

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const winWidth = 360
  const winHeight = 72

  indicatorWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((screenWidth - winWidth) / 2),
    y: Math.round(screenHeight - winHeight - 60),
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    hasShadow: false,
    backgroundColor: '#16213e',
    webPreferences: {
      preload: join(__dirname, '../preload/indicator.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  console.log(`[indicator] 窗口已创建, id=${indicatorWindow.id}`)

  // 捕获指示器窗口的 console 输出到主进程日志（必须在 loadURL/loadFile 之前注册）
  indicatorWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log(`[indicator-renderer] ${message}`)
  })

  // Windows 上设置为 screen-saver 级别确保始终置顶
  if (process.platform === 'win32') {
    indicatorWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  indicatorWindow.once('ready-to-show', () => {
    console.log(`[indicator] 窗口就绪, id=${indicatorWindow?.id}`)
    indicatorWindow?.showInactive()
  })

  indicatorWindow.webContents.on('did-finish-load', () => {
    console.log(`[indicator] 页面加载完成, id=${indicatorWindow?.id}`)
  })

  indicatorWindow.on('closed', () => {
    console.log(`[indicator] 窗口已关闭`)
    indicatorWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    indicatorWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/indicator.html`)
  } else {
    indicatorWindow.loadFile(join(__dirname, '../renderer/indicator.html'))
  }
}

/** 隐藏录音指示器窗口 */
export function hideIndicator(): void {
  if (!indicatorWindow) {
    console.log('[indicator] hideIndicator: 没有窗口需要隐藏')
    return
  }
  console.log(`[indicator] 隐藏窗口, id=${indicatorWindow.id}`)
  indicatorWindow.close()
  indicatorWindow = null
}

/** 获取指示器窗口实例 */
export function getIndicatorWindow(): BrowserWindow | null {
  return indicatorWindow
}

/** 波形数据发送计数（调试用） */
let waveformSendCount = 0

/** 向指示器窗口发送波形数据 */
export function sendWaveformToIndicator(data: number[]): void {
  if (!indicatorWindow) return
  waveformSendCount++
  if (waveformSendCount <= 5) {
    console.log(`[indicator] 发送波形数据 #${waveformSendCount} 到窗口 id=${indicatorWindow.id}, isLoading=${indicatorWindow.webContents.isLoading()}`)
  }
  indicatorWindow.webContents.send('waveform-data', data)
}

/** 向指示器窗口发送实时识别文本 */
export function sendPartialTextToIndicator(text: string): void {
  if (!indicatorWindow) return
  indicatorWindow.webContents.send('indicator-partial-text', text)
}

/** 通知指示器窗口状态变化 */
export function sendStatusToIndicator(status: 'recording' | 'processing'): void {
  if (!indicatorWindow) return
  indicatorWindow.webContents.send('indicator-status', status)
}
