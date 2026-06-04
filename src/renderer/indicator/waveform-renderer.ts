/** 声纹绘制：对称柱状波形风格（类似 Siri） */

/** 平滑系数（越大越平滑） */
const SMOOTHING = 0.3

/** 柱子数量 */
const BAR_COUNT = 32

/** 历史平滑数据 */
let smoothedData: Float32Array | null = null

/**
 * 绘制声纹波形
 * 将 Float32Array 时域数据降采样为 32 根对称柱状波形
 */
export function drawWaveform(canvas: HTMLCanvasElement, rawData: Float32Array): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 自适应尺寸
  const parent = canvas.parentElement
  if (parent) {
    canvas.width = parent.clientWidth * devicePixelRatio
    canvas.height = parent.clientHeight * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
  }

  const width = canvas.width / devicePixelRatio
  const height = canvas.height / devicePixelRatio

  // 降采样：每 BAR_COUNT 个区间取平均振幅
  const samplesPerBar = Math.floor(rawData.length / BAR_COUNT)
  const bars: number[] = []

  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0
    for (let j = 0; j < samplesPerBar; j++) {
      sum += Math.abs(rawData[i * samplesPerBar + j])
    }
    bars.push(sum / samplesPerBar)
  }

  // 平滑处理：避免波形跳动太剧烈
  if (!smoothedData || smoothedData.length !== BAR_COUNT) {
    smoothedData = new Float32Array(bars)
  } else {
    for (let i = 0; i < BAR_COUNT; i++) {
      smoothedData[i] = smoothedData[i] * SMOOTHING + bars[i] * (1 - SMOOTHING)
    }
  }

  // 清除画布
  ctx.clearRect(0, 0, width, height)

  // 绘制对称柱状波形
  const barWidth = (width * 0.8) / BAR_COUNT
  const gap = (width * 0.2) / (BAR_COUNT - 1)
  const startX = (width - (barWidth + gap) * BAR_COUNT + gap) / 2
  const centerY = height / 2
  const maxBarHeight = height * 0.4

  for (let i = 0; i < BAR_COUNT; i++) {
    const amplitude = smoothedData[i]
    const barHeight = Math.min(Math.max(2, amplitude * maxBarHeight * 5), maxBarHeight)

    const x = startX + i * (barWidth + gap)

    // 渐变色：中心淡、两端浓
    const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight)
    gradient.addColorStop(0, 'rgba(78, 204, 163, 0.9)')
    gradient.addColorStop(0.5, 'rgba(78, 204, 163, 0.6)')
    gradient.addColorStop(1, 'rgba(78, 204, 163, 0.9)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    const radius = barWidth / 2
    roundedRect(ctx, x, centerY - barHeight, barWidth, barHeight * 2, radius)
    ctx.fill()
  }
}

/** 圆角矩形路径 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number, r: number
): void {
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
