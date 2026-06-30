import { clipboard } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'

/** 触发 Ctrl+V 前后，留给剪贴板写入/目标应用取走内容的缓冲时间（毫秒） */
const CLIPBOARD_SETTLE_MS = 50
/** 触发 Ctrl+V 后，等待目标应用取走剪贴板内容再恢复的时间（毫秒） */
const PASTE_SETTLE_MS = 100

/**
 * 将文本粘贴到当前焦点输入框，且不污染用户原有的剪贴板内容。
 *
 * 思路：保存原剪贴板 → 写入识别文本 → 触发 Ctrl+V → 恢复原剪贴板。
 * 这样在任意应用（微信/浏览器/IDE）中都通用，且粘贴结束后剪贴板恢复原状。
 *
 * @param text 要粘贴的文本
 */
export async function pasteText(text: string): Promise<void> {
  // 1. 备份用户当前剪贴板内容（文本 + 可能的 HTML 富文本）
  const savedText = clipboard.readText()
  const savedHtml = clipboard.readHTML()
  /** 当前剪贴板是否包含 HTML 格式（用于决定恢复时是否写回 HTML） */
  const hasHtml = clipboard.availableFormats().includes('text/html')

  try {
    // 2. 写入识别文本并等待剪贴板就绪
    clipboard.writeText(text)
    await new Promise(resolve => setTimeout(resolve, CLIPBOARD_SETTLE_MS))

    // 3. 触发系统粘贴
    uIOhook.keyTap(UiohookKey.V, [UiohookKey.Ctrl])

    // 4. 等待目标应用取走剪贴板内容
    await new Promise(resolve => setTimeout(resolve, PASTE_SETTLE_MS))
  } finally {
    // 5. 恢复用户原有的剪贴板内容（无论粘贴成功与否都恢复）
    clipboard.writeText(savedText)
    if (hasHtml && savedHtml) {
      clipboard.writeHTML(savedHtml)
    }
  }
}
