import { uIOhook, UiohookKey, UiohookKeyboardEvent } from 'uiohook-napi'
import { powerMonitor } from 'electron'
import { get } from './config'

/** 按键事件回调 */
export type KeyCallback = () => void

/** 快捷键键名到 uiohook 键码的映射 */
export const HOTKEY_MAP: Record<string, number> = {
  RightAlt: UiohookKey.AltRight,
  Alt: UiohookKey.Alt,
  RightCtrl: UiohookKey.CtrlRight,
  Ctrl: UiohookKey.Ctrl,
  RightShift: UiohookKey.ShiftRight,
  Shift: UiohookKey.Shift,
  F1: UiohookKey.F1,
  F2: UiohookKey.F2,
  F3: UiohookKey.F3,
  F4: UiohookKey.F4,
  F5: UiohookKey.F5,
  F6: UiohookKey.F6,
  F7: UiohookKey.F7,
  F8: UiohookKey.F8,
  F9: UiohookKey.F9,
  F10: UiohookKey.F10,
  F11: UiohookKey.F11,
  F12: UiohookKey.F12,
}

/** 键码到键名的反向映射 */
const CODE_TO_NAME: Record<number, string> = {}
for (const [name, code] of Object.entries(HOTKEY_MAP)) {
  CODE_TO_NAME[code] = name
}

/** uiohook 键码转键名 */
export function keycodeToName(keycode: number): string | undefined {
  return CODE_TO_NAME[keycode]
}

let onKeyDown: KeyCallback | null = null
let onKeyUp: KeyCallback | null = null

/** 当前快捷键是否处于按下状态（防止 keydown/keyup 重复触发） */
let keyIsDown = false

/** 监听 keydown 事件 */
function handleKeyDown(event: UiohookKeyboardEvent): void {
  const hotkey = HOTKEY_MAP[get('hotkey')] ?? UiohookKey.AltRight
  if (event.keycode !== hotkey) return
  if (keyIsDown) return
  keyIsDown = true
  console.log(`[hotkey] keydown: ${CODE_TO_NAME[event.keycode] ?? event.keycode}`)
  onKeyDown?.()
}

/** 监听 keyup 事件 */
function handleKeyUp(event: UiohookKeyboardEvent): void {
  const hotkey = HOTKEY_MAP[get('hotkey')] ?? UiohookKey.AltRight
  if (event.keycode !== hotkey) return
  if (!keyIsDown) return
  keyIsDown = false
  console.log(`[hotkey] keyup: ${CODE_TO_NAME[event.keycode] ?? event.keycode}`)
  onKeyUp?.()
}

/**
 * 启动全局快捷键监听
 * @param keydownFn 按下回调
 * @param keyupFn 松开回调
 */
export function startHotkey(keydownFn: KeyCallback, keyupFn: KeyCallback): void {
  onKeyDown = keydownFn
  onKeyUp = keyupFn

  console.log(`[hotkey] 启动监听，当前快捷键: ${get('hotkey')}, 键码: ${HOTKEY_MAP[get('hotkey')] ?? 'unknown'}`)

  uIOhook.on('keydown', handleKeyDown)
  uIOhook.on('keyup', handleKeyUp)
  uIOhook.start()
  console.log('[hotkey] uIOhook.start() 已调用')
}

/** 停止快捷键监听 */
export function stopHotkey(): void {
  uIOhook.off('keydown', handleKeyDown)
  uIOhook.off('keyup', handleKeyUp)
  uIOhook.stop()
  onKeyDown = null
  onKeyUp = null
}

/** 重置按键状态并重新注册钩子（用于系统休眠/锁屏恢复后） */
export function restartHotkey(keydownFn: KeyCallback, keyupFn: KeyCallback): void {
  console.log('[hotkey] restartHotkey: 重置钩子...')
  stopHotkey()
  keyIsDown = false
  startHotkey(keydownFn, keyupFn)
  console.log('[hotkey] restartHotkey: 钩子已重建')
}

/** 看门狗轮询间隔（ms） */
const WATCHDOG_INTERVAL = 3000
/** getSystemIdleState 阈值（秒） */
const IDLE_THRESHOLD = 2

/** 上一次的空闲状态 */
let lastIdleState: string = 'active'
/** 轮询定时器 */
let watchdogTimer: ReturnType<typeof setInterval> | null = null
/** 保存回调引用（watchdog 重启钩子时需要） */
let savedKeydown: KeyCallback | null = null
let savedKeyup: KeyCallback | null = null

/** 启动快捷键健康看门狗：检测用户从空闲恢复活跃时自动重启钩子 */
export function startHotkeyWatchdog(keydownFn: KeyCallback, keyupFn: KeyCallback): void {
  savedKeydown = keydownFn
  savedKeyup = keyupFn
  lastIdleState = powerMonitor.getSystemIdleState(IDLE_THRESHOLD)

  watchdogTimer = setInterval(() => {
    const currentState = powerMonitor.getSystemIdleState(IDLE_THRESHOLD)

    if (currentState !== lastIdleState) {
      console.log(`[hotkey] 空闲状态变化: ${lastIdleState} -> ${currentState}`)

      /** 从非活跃状态恢复到活跃：重启钩子 */
      if (currentState === 'active' && (lastIdleState === 'idle' || lastIdleState === 'locked')) {
        console.log('[hotkey] 用户恢复活跃，重新注册快捷键钩子')
        restartHotkey(savedKeydown!, savedKeyup!)
      }

      lastIdleState = currentState
    }
  }, WATCHDOG_INTERVAL)

  console.log('[hotkey] 看门狗已启动')
}

/** 临时监听任意按键（用于设置界面捕获用户按下的键） */
export function captureKey(callback: (keyName: string) => void): () => void {
  const handler = (event: UiohookKeyboardEvent) => {
    const name = CODE_TO_NAME[event.keycode]
    if (name) {
      callback(name)
    }
  }
  uIOhook.on('keydown', handler)
  /** 返回取消函数 */
  return () => {
    uIOhook.off('keydown', handler)
  }
}
