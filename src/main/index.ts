import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createTray, updateTrayStatus, destroyTray, updateAlwaysOnMenu } from './tray'
import { startHotkey, stopHotkey, startHotkeyWatchdog, HOTKEY_MAP, captureKey } from './hotkey'
import { pasteText } from './paster'
import { AsrStreamClient } from './asr-client'
import { encodeWav } from './wav-encoder'
import { getConfig, updateConfig } from './config'
import { showIndicator, hideIndicator, sendWaveformToIndicator, sendStatusToIndicator, sendPartialTextToIndicator } from './indicator'
import { getHistory, addHistoryEntry, clearHistory } from './history'
import { startAlwaysOn, stopAlwaysOn, sendAlwaysOnChunk, isAlwaysOnActive, initAlwaysOn } from './always-on'

/** 窗口位置持久化 */
interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

/** 窗口位置文件路径 */
function getBoundsPath(): string {
  return join(app.getPath('userData'), 'window-bounds.json')
}

/** 加载窗口位置 */
function loadBounds(): WindowBounds | null {
  if (!existsSync(getBoundsPath())) return null
  const raw = readFileSync(getBoundsPath(), 'utf-8')
  return JSON.parse(raw) as WindowBounds
}

/** 保存窗口位置 */
function saveBounds(bounds: WindowBounds): void {
  writeFileSync(getBoundsPath(), JSON.stringify(bounds, null, 2), 'utf-8')
}

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

/** 已确认的离线纠错文本（多句累积） */
let confirmedText = ''
/** 当前句子在线实时文本 */
let onlineText = ''

/**
 * 创建主窗口
 */
function createWindow(): BrowserWindow {
  /** 从持久化文件恢复窗口位置 */
  const savedBounds = loadBounds()

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 520,
    height: savedBounds?.height ?? 420,
    x: savedBounds?.x,
    y: savedBounds?.y,
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

  // 窗口移动或缩放时保存位置
  mainWindow.on('close', () => {
    if (!mainWindow) return
    const bounds = mainWindow.getBounds()
    saveBounds(bounds)
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
  confirmedText = ''
  onlineText = ''

  // 创建 ASR 流式客户端，传入当前配置
  const config = getConfig()
  asrClient = new AsrStreamClient(config.asrUrl, config.hotwords)

  asrClient.on('text', (text: string, _isFinal: boolean, mode: string) => {
    if (!text) return

    if (mode.endsWith('offline')) {
      // 2pass-offline: 当前分片的纠错文本，追加到 confirmedText
      confirmedText += text
      onlineText = ''
    } else {
      // 2pass-online: 当前分片的实时累积文本
      onlineText = text
    }
    // 实时推送: 已确认文本 + 当前正在识别的文本
    const fullText = confirmedText + onlineText
    mainWindow?.webContents.send('partial-text', fullText)
    // 指示器显示完整文本，CSS 自动滚动到末尾
    sendPartialTextToIndicator(fullText)
  })

  // 连接 ASR 服务（不 await，录音可以立即开始）
  asrClient.connect().then(() => {
    console.log('[main] ASR 已连接，等待音频数据...')
  }).catch((err: Error) => {
    console.log(`[main] ASR 连接失败: ${err.message}`)
  })

  mainWindow?.webContents.send('start-recording-cmd')
  console.log('[main] 开始录音')
}

/** 获取当前完整识别文本（已确认 + 在线实时） */
function getFullText(): string {
  return confirmedText + onlineText
}

/** 停止录音并完成识别 */
async function stopRecording(): Promise<void> {
  if (state !== 'recording') return
  setState('processing')
  mainWindow?.webContents.send('stop-recording-cmd')
  console.log('[main] 停止录音')

  // 记住当前 onlineText，finish 后等待它被 offline 纠错替换
  const pendingOnline = onlineText

  // 告诉 ASR 说话结束（触发最后一次 offline 纠错）
  asrClient?.finish()

  // 等待服务端返回 is_final=true（最终 2pass 纠错完成），最多 5 秒
  if (pendingOnline) {
    await asrClient?.waitForFinal(5000)
  }

  asrClient?.close()
  asrClient = null

  let result = getFullText()
  console.log(`[main] stopRecording: confirmedText="${confirmedText}", onlineText="${onlineText}"`)

  // 如果 online 模式没拿到结果，尝试用收集的 PCM fallback 离线识别
  if (!result && pcmBuffers.length > 0) {
    console.log('[main] online 模式无结果，尝试离线 fallback')
    result = await fallbackOfflineAsr()
  }

  // 粘贴最终文本
  if (result && result.trim()) {
    console.log(`[main] 最终结果: "${result}"`)
    await pasteText(result)
    // 保存到历史记录
    addHistoryEntry(result, mainWindow)
  } else {
    console.log('[main] 无识别结果')
  }

  setState('idle')
}

/** 处理实时 PCM chunk：转发给 ASR + 缓存 + 全天候转发 */
function handleAudioChunk(data: ArrayBuffer): void {
  const chunk = Buffer.from(data)

  // 空 buffer 是停止标记，不缓存
  if (chunk.length === 0) return

  pcmBuffers.push(chunk)

  // 实时转发给热键 ASR
  const STRIDE = 1920
  for (let offset = 0; offset < chunk.length; offset += STRIDE) {
    const sub = chunk.subarray(offset, Math.min(offset + STRIDE, chunk.length))
    asrClient?.sendChunk(sub)
  }

  // 转发给全天候 ASR（独立连接）
  sendAlwaysOnChunk(chunk)
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

  const config = getConfig()
  const offlineClient = new AsrStreamClient(config.asrUrl, config.hotwords)
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
    if (waveformCount <= 3) {
      console.log(`[main] 收到波形数据 #${waveformCount}: ${data.length} samples`)
    }
    sendWaveformToIndicator(data)
  })

  // 兼容旧的 complete-pcm
  ipcMain.on('complete-pcm', (_event, data: ArrayBuffer) => {
    handleAudioChunk(data)
  })

  ipcMain.on('config-changed', (_event, config: Record<string, unknown>) => {
    console.log(`[main] 收到配置更新: ${JSON.stringify(config)}`)
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

  /** 获取历史记录 */
  ipcMain.handle('get-history', () => getHistory())

  /** 清空历史记录 */
  ipcMain.on('clear-history', () => {
    clearHistory()
  })

  /** 获取全天候监听状态 */
  ipcMain.handle('get-always-on-status', () => isAlwaysOnActive())

  /** 切换全天候监听 */
  ipcMain.handle('toggle-always-on', () => {
    if (isAlwaysOnActive()) {
      stopAlwaysOn()
      updateConfig({ alwaysOn: false })
    } else {
      const config = getConfig()
      startAlwaysOn(config.asrUrl, config.hotwords)
      updateConfig({ alwaysOn: true })
    }
    return isAlwaysOnActive()
  })
}

/** 应用启动 */
app.whenReady().then(() => {
  createWindow()
  createTray(
    () => {
      stopAlwaysOn()
      stopHotkey()
      destroyTray()
      app.quit()
    },
    () => {
      mainWindow?.webContents.send('open-settings')
      mainWindow?.show()
    },
    () => {
      // 全天候监听切换
      if (isAlwaysOnActive()) {
        stopAlwaysOn()
        updateConfig({ alwaysOn: false })
        updateAlwaysOnMenu(false)
      } else {
        const cfg = getConfig()
        startAlwaysOn(cfg.asrUrl, cfg.hotwords)
        updateConfig({ alwaysOn: true })
        updateAlwaysOnMenu(true)
      }
    },
  )

  registerIpc()

  // 注册 always-on 的窗口获取器
  initAlwaysOn(() => mainWindow)

  startHotkey(
    () => startRecording(),
    () => stopRecording(),
  )

  /** 看门狗：检测用户从空闲恢复活跃时自动重启快捷键钩子 */
  startHotkeyWatchdog(
    () => startRecording(),
    () => stopRecording(),
  )

  console.log('[main] VoicePipe 已启动')

  // 如果配置中开启了全天候监听，等渲染进程就绪后自动启动
  const config = getConfig()
  console.log(`[main] 配置: alwaysOn=${config.alwaysOn}, mainWindow=${!!mainWindow}, isLoading=${mainWindow?.webContents.isLoading()}`)
  if (config.alwaysOn && mainWindow) {
    const startAlways = () => {
      console.log('[main] 渲染进程就绪，启动全天候监听')
      startAlwaysOn(config.asrUrl, config.hotwords)
      updateAlwaysOnMenu(true)
    }
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', startAlways)
    } else {
      startAlways()
    }
  }
})

// 主窗口关闭时退出应用
app.on('window-all-closed', () => {
  stopAlwaysOn()
  stopHotkey()
  destroyTray()
  app.quit()
})
