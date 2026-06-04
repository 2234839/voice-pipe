/**
 * WAV 编码器
 * 将 16kHz 16bit 单声道 PCM 数据编码为标准 WAV 格式
 * 手写 44-byte header，无外部依赖
 */

/** WAV 文件头大小 */
const WAV_HEADER_SIZE = 44

/** 写入 ASCII 字符串到 DataView */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * 将 PCM Int16Array 编码为 WAV Buffer
 * @param pcm 16kHz 16bit 单声道 PCM 数据
 * @param sampleRate 采样率（默认 16000）
 * @returns 完整 WAV 文件的 Buffer
 */
export function encodeWav(pcm: Int16Array, sampleRate = 16000): Buffer {
  const dataLength = pcm.length * 2 // Int16 = 2 bytes
  const totalLength = WAV_HEADER_SIZE + dataLength

  const buffer = Buffer.alloc(totalLength)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalLength - 8, true) // 文件大小 - 8
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk 大小
  view.setUint16(20, 1, true) // PCM 格式
  view.setUint16(22, 1, true) // 单声道
  view.setUint32(24, sampleRate, true) // 采样率
  view.setUint32(28, sampleRate * 2, true) // 字节率 (sampleRate * channels * bitsPerSample/8)
  view.setUint16(32, 2, true) // 块对齐 (channels * bitsPerSample/8)
  view.setUint16(34, 16, true) // 位深度

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // PCM 数据
  const pcmBuffer = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  pcmBuffer.copy(buffer, WAV_HEADER_SIZE)

  return buffer
}
