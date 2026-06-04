/**
 * 设置界面逻辑
 * 管理配置表单的加载、保存和自定义快捷键捕获
 */

/** 初始化设置界面 */
export function initSettings(): void {
  loadCurrentConfig()

  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings)
  document.getElementById('btn-devtools')?.addEventListener('click', () => {
    window.voicePipe.openDevTools()
  })

  // 自定义快捷键：点击输入框开始捕获
  const hotkeyInput = document.getElementById('setting-hotkey') as HTMLInputElement
  hotkeyInput?.addEventListener('focus', () => {
    hotkeyInput.value = '按下快捷键...'
    hotkeyInput.classList.add('capturing')
    window.voicePipe.startKeyCapture((keyName: string) => {
      hotkeyInput.value = keyName
      hotkeyInput.classList.remove('capturing')
      window.voicePipe.stopKeyCapture()
      hotkeyInput.blur()
    })
  })

  hotkeyInput?.addEventListener('blur', () => {
    window.voicePipe.stopKeyCapture()
    hotkeyInput.classList.remove('capturing')
    // 如果没捕获到有效值，恢复默认
    if (hotkeyInput.value === '按下快捷键...') {
      hotkeyInput.value = 'RightAlt'
    }
  })
}

/** 加载当前配置到表单 */
async function loadCurrentConfig(): Promise<void> {
  const config = await window.voicePipe.getConfig()
  const hotkeyInput = document.getElementById('setting-hotkey') as HTMLInputElement
  const asrUrlInput = document.getElementById('setting-asr-url') as HTMLInputElement
  const notificationInput = document.getElementById('setting-notification') as HTMLInputElement

  if (hotkeyInput && config.hotkey) hotkeyInput.value = String(config.hotkey)
  if (asrUrlInput && config.asrUrl) asrUrlInput.value = String(config.asrUrl)
  if (notificationInput) notificationInput.checked = config.notification !== false
}

/** 保存设置到主进程 */
async function saveSettings(): Promise<void> {
  const hotkey = (document.getElementById('setting-hotkey') as HTMLInputElement)?.value
  const asrUrl = (document.getElementById('setting-asr-url') as HTMLInputElement)?.value
  const notification = (document.getElementById('setting-notification') as HTMLInputElement)?.checked

  window.voicePipe.sendConfigChanged({
    hotkey,
    asrUrl,
    notification,
  })

  // 切换回主界面
  const panel = document.getElementById('settings-panel')
  panel?.classList.add('hidden')

  // 更新状态栏提示
  const statusText = document.getElementById('status-text')
  if (statusText) {
    statusText.textContent = `就绪 — 按住 ${hotkey} 开始说话`
  }
}
