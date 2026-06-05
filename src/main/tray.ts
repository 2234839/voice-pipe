import { Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'

/** 托盘图标状态 */
export type TrayStatus = 'idle' | 'recording' | 'processing'

/** 状态对应的 tooltip 文本 */
const STATUS_TEXTS: Record<TrayStatus, string> = {
  idle: 'VoicePipe — 就绪',
  recording: 'VoicePipe — 录音中...',
  processing: 'VoicePipe — 识别中...',
}

let tray: Tray | null = null
/** 托盘菜单回调 */
let callbacks: {
  onQuit: () => void
  onOpenSettings: () => void
  onAlwaysOnToggle: () => void
} | null = null

/** 全天候菜单选中状态 */
let alwaysOnChecked = false

/**
 * 创建系统托盘
 */
export function createTray(
  onQuit: () => void,
  onOpenSettings: () => void,
  onAlwaysOnToggle: () => void,
): Tray {
  const iconPath = join(__dirname, '../../resources/icon.ico')
  const icon = nativeImage.createFromPath(iconPath)

  callbacks = { onQuit, onOpenSettings, onAlwaysOnToggle }

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip(STATUS_TEXTS.idle)
  rebuildMenu()

  return tray
}

/** 重建托盘菜单（checkbox 状态变更时调用） */
function rebuildMenu(): void {
  if (!tray || !callbacks) return

  const contextMenu = Menu.buildFromTemplate([
    { label: '全天候监听', type: 'checkbox', checked: alwaysOnChecked, click: () => callbacks!.onAlwaysOnToggle() },
    { label: '设置', click: () => callbacks!.onOpenSettings() },
    { type: 'separator' },
    { label: '退出', click: () => callbacks!.onQuit() },
  ])

  tray.setContextMenu(contextMenu)
}

/** 更新全天候菜单的选中状态 */
export function updateAlwaysOnMenu(checked: boolean): void {
  alwaysOnChecked = checked
  rebuildMenu()
}

/**
 * 更新托盘状态（图标 + tooltip）
 */
export function updateTrayStatus(status: TrayStatus): void {
  if (!tray) return

  tray.setToolTip(STATUS_TEXTS[status])

  const iconFiles: Record<TrayStatus, string> = {
    idle: 'icon.ico',
    recording: 'icon-recording.ico',
    processing: 'icon-processing.ico',
  }
  const iconPath = join(__dirname, '../../resources', iconFiles[status])
  const icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty()) {
    tray.setImage(icon)
  }
}

/** 销毁托盘 */
export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
