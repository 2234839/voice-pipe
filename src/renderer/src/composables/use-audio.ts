/**
 * 封装 AudioCapture 的 Vue composable
 * 管理录音的启动/停止、PCM 和波形数据的 IPC 转发
 * 支持全天候模式与热键模式独立控制，共享同一个麦克风
 */
import { AudioCapture } from '../audio-capture'

/** 音频采集器实例（全局单例） */
const audioCapture = new AudioCapture()

/** 是否已初始化回调 */
let callbacksSet = false

/** 引用计数：全天候和热键各自独立控制，都停止时才真正关闭麦克风 */
let alwaysOnRefCount = 0
let hotkeyRefCount = 0

/** 是否正在运行 */
let isRunning = false

/**
 * 确保 AudioCapture 回调已注册
 */
function ensureCallbacks(): void {
  if (callbacksSet) return
  callbacksSet = true

  // 波形数据转发给指示器窗口
  audioCapture.setWaveformCallback((data) => {
    window.voicePipe.sendWaveformData(Array.from(data))
  })

  // PCM chunk 转发给主进程
  audioCapture.setPcmChunkCallback((chunk) => {
    const buf = new ArrayBuffer(chunk.byteLength)
    new Int16Array(buf).set(chunk)
    window.voicePipe.sendAudioChunk(buf)
  })
}

/** 内部启动（引用计数） */
async function startCapture(): Promise<void> {
  if (isRunning) return
  isRunning = true
  ensureCallbacks()
  await audioCapture.start()
}

/** 内部停止（引用计数） */
function stopCapture(): void {
  if (!isRunning) return
  isRunning = false
  audioCapture.stop()
}

/**
 * 音频录制 composable
 * 录音由主进程通过 IPC 指令控制
 */
export function useAudio() {
  /** 热键模式开始录音 */
  async function start() {
    hotkeyRefCount++
    await startCapture()
  }

  /** 热键模式停止录音 */
  function stop() {
    hotkeyRefCount = Math.max(0, hotkeyRefCount - 1)
    // 只有两个引用都为 0 时才真正停止
    if (hotkeyRefCount === 0 && alwaysOnRefCount === 0) {
      stopCapture()
    }
    // 发送空 buffer 作为结束标记
    window.voicePipe.sendAudioChunk(new ArrayBuffer(0))
  }

  /** 全天候模式开始采集 */
  async function startAlwaysOn() {
    alwaysOnRefCount++
    await startCapture()
  }

  /** 全天候模式停止采集 */
  function stopAlwaysOn() {
    alwaysOnRefCount = Math.max(0, alwaysOnRefCount - 1)
    if (hotkeyRefCount === 0 && alwaysOnRefCount === 0) {
      stopCapture()
    }
  }

  return { start, stop, startAlwaysOn, stopAlwaysOn }
}
