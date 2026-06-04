/** 指示器窗口渲染进程入口 */
import { initWaveform, updateWaveform } from './waveform-renderer'

const waveformSvg = document.querySelector<SVGSVGElement>('#waveform-svg')
const processingLabel = document.getElementById('processing-label')
const indicator = document.getElementById('indicator')

console.log(`[indicator-renderer] 初始化`)
console.log(`[indicator-renderer] waveformSvg: ${waveformSvg ? 'found' : 'NULL'}`)
console.log(`[indicator-renderer] window.indicator: ${window.indicator ? 'exists' : 'UNDEFINED'}`)

if (waveformSvg) {
  initWaveform(waveformSvg)
  console.log(`[indicator-renderer] SVG 初始化完成, clientWidth=${waveformSvg.clientWidth}, clientHeight=${waveformSvg.clientHeight}`)
}

// 接收波形数据并更新 SVG
let dataCount = 0
window.indicator?.onWaveformData((data: number[]) => {
  dataCount++
  if (dataCount <= 3) {
    console.log(`[indicator-renderer] 收到波形数据 #${dataCount}: ${data.length} samples, 前3个值: ${data.slice(0, 3).join(',')}`)
  }
  if (waveformSvg) {
    updateWaveform(waveformSvg, new Float32Array(data))
  }
})

// 接收状态变化
window.indicator?.onStatusChange((status: string) => {
  console.log(`[indicator-renderer] 状态变化: ${status}`)
  if (status === 'processing') {
    waveformSvg?.classList.add('hidden')
    processingLabel?.classList.remove('hidden')
  } else if (status === 'idle') {
    indicator?.classList.add('fade-out')
  }
})
