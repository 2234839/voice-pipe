/** 指示器窗口渲染进程入口 */
import { drawWaveform } from './waveform-renderer'

const canvas = document.getElementById('waveform-canvas') as HTMLCanvasElement
const processingLabel = document.getElementById('processing-label')!
const indicator = document.getElementById('indicator')!

// 接收波形数据并绘制
window.indicator.onWaveformData((data: number[]) => {
  drawWaveform(canvas, new Float32Array(data))
})

// 接收状态变化
window.indicator.onStatusChange((status: string) => {
  if (status === 'processing') {
    // 切换到"识别中"：隐藏波形，显示 spinner
    canvas.classList.add('hidden')
    processingLabel.classList.remove('hidden')
  } else if (status === 'idle') {
    // 播放消失动画
    indicator.classList.add('fade-out')
  }
})
