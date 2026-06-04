/** SVG 声纹波形渲染器 — 纯 DOM，不依赖 Canvas/GPU */

/** 柱子数量（与 AudioWorklet 输出的波形样本数一致） */
const BAR_COUNT = 64

/** 平滑系数（越大越平滑，0.7 表示 70% 保留旧值 + 30% 新值） */
const SMOOTHING = 0.7

/** 历史平滑数据 */
let smoothedData: Float32Array | null = null

/** SVG 柱子元素缓存 */
let barElements: SVGRectElement[] = []

/** SVG viewBox 尺寸 */
const SVG_WIDTH = 200
const SVG_HEIGHT = 48

/**
 * 初始化 SVG 波形容器
 */
export function initWaveform(container: SVGSVGElement): void {
  container.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)
  container.setAttribute('preserveAspectRatio', 'none')
  container.innerHTML = ''
  barElements = []

  for (let i = 0; i < BAR_COUNT; i++) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('fill', '#4ecca3')
    rect.setAttribute('rx', '1')
    barElements.push(rect)
    container.appendChild(rect)
  }

  // 初始化所有柱子为最小高度
  updateBars(new Float32Array(BAR_COUNT))
}

/**
 * 更新波形
 * rawData 直接来自 AudioWorklet，长度 = BAR_COUNT
 */
export function updateWaveform(
  container: SVGSVGElement,
  rawData: Float32Array
): void {
  // 确保柱子元素已创建
  if (barElements.length !== BAR_COUNT) {
    initWaveform(container)
  }

  // 取绝对值作为振幅
  const bars = new Float32Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    bars[i] = Math.abs(rawData[i])
  }

  // 平滑
  if (!smoothedData || smoothedData.length !== bars.length) {
    smoothedData = new Float32Array(bars)
  } else {
    for (let i = 0; i < bars.length; i++) {
      smoothedData[i] = smoothedData[i] * SMOOTHING + bars[i] * (1 - SMOOTHING)
    }
  }

  updateBars(smoothedData)
}

/** 更新 SVG 柱子位置和大小 */
function updateBars(data: Float32Array): void {
  const count = data.length
  const totalBarWidth = SVG_WIDTH * 0.92
  const barWidth = totalBarWidth / count * 0.65
  const gap = totalBarWidth / count * 0.35
  const startX = (SVG_WIDTH - totalBarWidth) / 2
  const centerY = SVG_HEIGHT / 2
  const maxBarHeight = SVG_HEIGHT * 0.42

  for (let i = 0; i < count; i++) {
    const amplitude = data[i]
    const barHeight = Math.min(Math.max(0.5, amplitude * maxBarHeight * 60), maxBarHeight)
    const x = startX + i * (barWidth + gap)

    const rect = barElements[i]
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(centerY - barHeight))
    rect.setAttribute('width', String(barWidth))
    rect.setAttribute('height', String(barHeight * 2))

    const distFromCenter = Math.abs(i - count / 2) / (count / 2)
    const opacity = 0.4 + 0.6 * (1 - distFromCenter)
    rect.setAttribute('fill-opacity', String(opacity.toFixed(2)))
  }
}
