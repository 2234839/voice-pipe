import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'

/** 托盘图标状态 */
export type TrayStatus = 'idle' | 'recording' | 'processing'

/** 状态对应的 tooltip 文本 */
const STATUS_TEXTS: Record<TrayStatus, string> = {
  idle: 'VoicePipe — 就绪，按住 RightAlt 开始说话',
  recording: 'VoicePipe — 录音中...',
  processing: 'VoicePipe — 识别中...',
}

let tray: Tray | null = null

/**
 * 创建系统托盘
 * @param onQuit 退出回调
 * @param onOpenSettings 打开设置回调
 */
export function createTray(onQuit: () => void, onOpenSettings: () => void): Tray {
  const iconPath = join(__dirname, '../../resources/icon.ico')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip(STATUS_TEXTS.idle)

  const contextMenu = Menu.buildFromTemplate([
    { label: '设置', click: onOpenSettings },
    { type: 'separator' },
    { label: '退出', click: onQuit },
  ])

  tray.setContextMenu(contextMenu)

  return tray
}

/**
 * 更新托盘状态（图标 + tooltip）
 * @param status 当前状态
 */
export function updateTrayStatus(status: TrayStatus): void {
  if (!tray) return

  tray.setToolTip(STATUS_TEXTS[status])

  // 根据状态切换图标
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
