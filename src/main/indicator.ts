import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

/** 指示器窗口实例 */
let indicatorWindow: BrowserWindow | null = null

/** 显示录音指示器窗口 */
export function showIndicator(): void {
  if (indicatorWindow) return

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const winWidth = 280
  const winHeight = 72

  indicatorWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((screenWidth - winWidth) / 2),
    y: Math.round(screenHeight - winHeight - 80),
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/indicator.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Windows 上设置为 screen-saver 级别确保始终置顶
  if (process.platform === 'win32') {
    indicatorWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  indicatorWindow.once('ready-to-show', () => {
    indicatorWindow?.showInactive()
  })

  indicatorWindow.on('closed', () => {
    indicatorWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    indicatorWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/indicator.html`)
  } else {
    indicatorWindow.loadFile(join(__dirname, '../renderer/indicator.html'))
  }
}

/** 隐藏录音指示器窗口（带淡出动画） */
export async function hideIndicator(): Promise<void> {
  if (!indicatorWindow) return
  // 通知指示器播放消失动画
  indicatorWindow.webContents.send('indicator-status', 'idle')
  await new Promise(resolve => setTimeout(resolve, 200))
  indicatorWindow?.close()
  indicatorWindow = null
}

/** 获取指示器窗口实例 */
export function getIndicatorWindow(): BrowserWindow | null {
  return indicatorWindow
}

/** 向指示器窗口发送波形数据 */
export function sendWaveformToIndicator(data: number[]): void {
  if (!indicatorWindow) return
  indicatorWindow.webContents.send('waveform-data', data)
}

/** 通知指示器窗口状态变化 */
export function sendStatusToIndicator(status: 'recording' | 'processing'): void {
  if (!indicatorWindow) return
  indicatorWindow.webContents.send('indicator-status', status)
}
