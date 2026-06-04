import { clipboard } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'

/**
 * 将文本写入剪贴板并触发 Ctrl+V 粘贴
 * @param text 要粘贴的文本
 */
export async function pasteText(text: string): Promise<void> {
  clipboard.writeText(text)

  // 等待剪贴板就绪
  await new Promise(resolve => setTimeout(resolve, 50))

  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Ctrl])
}
