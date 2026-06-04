import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { createTray, updateTrayStatus, destroyTray } from './tray'
import { startHotkey, stopHotkey, HOTKEY_MAP, captureKey } from './hotkey'
import { pasteText } from './paster'
import { AsrStreamClient } from './asr-client'
import { encodeWav } from './wav-encoder'
import { getConfig, updateConfig } from './config'
import { showIndicator, hideIndicator, sendWaveformToIndicator, sendStatusToIndicator } from './indicator'

/** 禁用 GPU 加速（避免在 WSL 网络路径 / 远程桌面等环境下 GPU 进程崩溃） */
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('no-sandbox')

/** 单实例锁：禁止同时运行多个 VoicePipe */
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  // 第二个实例启动时，聚焦已有实例的主窗口
  app.on('second-instance', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

/** 将 console.log/write 重定向到日志文件，方便排查闪退 */
const logFile = join(app.getPath('temp'), 'voicepipe-debug.log')
const logStream = require('fs').createWriteStream(logFile, { flags: 'w' })
const origLog = console.log
console.log = (...args: unknown[]) => {
  origLog(...args)
  logStream.write(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n')
}
origLog(`[main] 日志文件: ${logFile}`)

/** 应用状态 */
type AppState = 'idle' | 'recording' | 'processing'

/** 当前状态 */
let state: AppState = 'idle'

/** 主窗口 */
let mainWindow: BrowserWindow | null = null

/** ASR 流式客户端 */
let asrClient: AsrStreamClient | null = null

/** PCM 缓冲（用于最终 fallback 离线识别） */
let pcmBuffers: Buffer[] = []

/** 最终识别文本（用于粘贴） */
let finalText = ''

/**
 * 创建主窗口
 * 隐藏的承载窗口，用于音频采集（需要 getUserMedia）
 */
function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 420,
    show: true,
    autoHideMenuBar: true,
    title: 'VoicePipe',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // F12 打开/关闭开发者工具
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  return mainWindow
}

/** 切换状态 */
function setState(newState: AppState): void {
  console.log(`[main] setState: ${state} -> ${newState}`)
  state = newState
  updateTrayStatus(newState)
  mainWindow?.webContents.send('status-change', newState)

  // 指示器窗口状态同步
  if (newState === 'recording') {
    showIndicator()
  } else if (newState === 'processing') {
    sendStatusToIndicator('processing')
  } else if (newState === 'idle') {
    void hideIndicator()
  }
}

/** 开始录音 */
function startRecording(): void {
  if (state !== 'idle') return
  setState('recording')
  pcmBuffers = []
  finalText = ''

  // 创建 ASR 流式客户端
  const config = getConfig()
  asrClient = new AsrStreamClient(config.asrUrl)

  asrClient.on('text', (text: string, _isFinal: boolean, mode: string) => {
    if (text) {
      if (mode.endsWith('offline')) {
        // 2pass-offline 纠错结果，直接覆盖
        finalText = text
      } else {
        // 2pass-online / online 实时增量，累积拼接
        finalText += text
      }
    }
    // 实时推送累积的完整文本到渲染进程
    mainWindow?.webContents.send('partial-text', finalText)
  })

  // 连接 ASR 服务（不 await，录音可以立即开始）
  asrClient.connect().then(() => {
    console.log('[main] ASR 已连接，等待音频数据...')
  }).catch((err: Error) => {
    console.log(`[main] ASR 连接失败: ${err.message}`)
    // 连接失败不影响录音，后续会用 fallback 离线识别
  })

  mainWindow?.webContents.send('start-recording-cmd')
  console.log('[main] 开始录音')
}

/** 停止录音并完成识别 */
async function stopRecording(): Promise<void> {
  if (state !== 'recording') return
  setState('processing')
  mainWindow?.webContents.send('stop-recording-cmd')
  console.log('[main] 停止录音')

  // 告诉 ASR 说话结束
  asrClient?.finish()

  // 等待 ASR 最终结果（最多 10 秒）
  for (let i = 0; i < 100; i++) {
    if (finalText) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  asrClient?.close()
  asrClient = null

  // 如果 online 模式没拿到结果，尝试用收集的 PCM fallback 离线识别
  if (!finalText && pcmBuffers.length > 0) {
    console.log('[main] online 模式无结果，尝试离线 fallback')
    finalText = await fallbackOfflineAsr()
  }

  // 粘贴最终文本
  if (finalText && finalText.trim()) {
    console.log(`[main] 最终结果: "${finalText}"`)
    await pasteText(finalText)
  } else {
    console.log('[main] 无识别结果')
  }

  setState('idle')
}

/** 处理实时 PCM chunk：转发给 ASR + 缓存 */
function handleAudioChunk(data: ArrayBuffer): void {
  const chunk = Buffer.from(data)

  // 空 buffer 是停止标记，不缓存
  if (chunk.length === 0) return

  pcmBuffers.push(chunk)

  // 实时转发给 ASR（online 模式每 1920 字节一个 chunk）
  // stride = 60 * chunk_size[1] / chunk_interval / 1000 * sample_rate * 2
  //        = 60 * 10 / 10 / 1000 * 16000 * 2 = 1920
  const STRIDE = 1920
  for (let offset = 0; offset < chunk.length; offset += STRIDE) {
    const sub = chunk.subarray(offset, Math.min(offset + STRIDE, chunk.length))
    asrClient?.sendChunk(sub)
  }
}

/** Fallback 离线识别（当 online 模式失败时） */
async function fallbackOfflineAsr(): Promise<string> {
  if (pcmBuffers.length === 0) return ''

  const totalLength = pcmBuffers.reduce((sum, buf) => sum + buf.length, 0)
  const merged = Buffer.concat(pcmBuffers, totalLength)
  pcmBuffers = []

  const pcm = new Int16Array(merged.buffer, merged.byteOffset, merged.byteLength / 2)
  const wav = encodeWav(pcm)

  console.log(`[main] 离线 fallback WAV: ${wav.byteLength} 字节`)

  // 用临时的 offline 连接
  const config = getConfig()
  const offlineClient = new AsrStreamClient(config.asrUrl)
  // 暂时用简单方式：直接把完整 WAV 发送
  // TODO: 如果需要可以恢复 transcribe 函数
  offlineClient.close()
  return ''
}

/** 按键捕获的取消函数 */
let cancelKeyCapture: (() => void) | null = null

/** 注册 IPC 处理器 */
function registerIpc(): void {
  // 实时接收 PCM chunk
  ipcMain.on('audio-chunk', (_event, data: ArrayBuffer) => {
    handleAudioChunk(data)
  })

  // 波形数据：主窗口渲染进程 → 指示器窗口
  let waveformCount = 0
  ipcMain.on('waveform-data', (_event, data: number[]) => {
    waveformCount++
    if (waveformCount <= 5) {
      console.log(`[main] 收到波形数据 #${waveformCount}: ${data.length} samples`)
    }
    sendWaveformToIndicator(data)
  })

  // 兼容旧的 complete-pcm（渲染进程停止时发送）
  ipcMain.on('complete-pcm', (_event, data: ArrayBuffer) => {
    handleAudioChunk(data)
  })

  ipcMain.on('config-changed', (_event, config: Record<string, unknown>) => {
    updateConfig(config as Parameters<typeof updateConfig>[0])
  })

  ipcMain.handle('get-config', () => getConfig())

  /** 打开开发者工具 */
  ipcMain.handle('open-dev-tools', () => {
    mainWindow?.webContents.openDevTools()
  })

  /** 获取支持的快捷键列表 */
  ipcMain.handle('get-supported-hotkeys', () => {
    return Object.keys(HOTKEY_MAP)
  })

  /** 开始捕获按键 */
  ipcMain.on('start-key-capture', (event) => {
    cancelKeyCapture?.()
    cancelKeyCapture = captureKey((keyName) => {
      event.sender.send('key-captured', keyName)
    })
  })

  /** 停止捕获按键 */
  ipcMain.on('stop-key-capture', () => {
    cancelKeyCapture?.()
    cancelKeyCapture = null
  })
}

/** 应用启动 */
app.whenReady().then(() => {
  createWindow()
  createTray(
    () => {
      stopHotkey()
      destroyTray()
      app.quit()
    },
    () => {
      mainWindow?.webContents.send('open-settings')
      mainWindow?.show()
    },
  )

  registerIpc()

  startHotkey(
    () => startRecording(),
    () => stopRecording(),
  )

  console.log('[main] VoicePipe 已启动')
})

// 主窗口关闭时退出应用
app.on('window-all-closed', () => {
  stopHotkey()
  destroyTray()
  app.quit()
})
