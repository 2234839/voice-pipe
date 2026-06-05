/**
 * 封装 AudioCapture 的 Vue composable
 * 管理录音的启动/停止、PCM 和波形数据的 IPC 转发
 */
import { AudioCapture } from '../audio-capture'

/** 音频采集器实例（全局单例） */
const audioCapture = new AudioCapture()

/** 是否已初始化回调 */
let callbacksSet = false

/**
 * 音频录制 composable
 * 录音由主进程通过 IPC 指令控制
 */
export function useAudio() {
  if (!callbacksSet) {
    callbacksSet = true

    // 波形数据转发给指示器窗口
    audioCapture.setWaveformCallback((data) => {
      window.voicePipe.sendWaveformData(Array.from(data))
    })

    // PCM chunk 转发给主进程
    audioCapture.setPcmChunkCallback((chunk) => {
      const buf = new ArrayBuffer(chunk.byteLength)
      new Int16Array(buf).set(chunk)
      window.voicePipe.sendAudioChunk(buf)
    })
  }

  /** 开始录音 */
  async function start() {
    await audioCapture.start()
  }

  /** 停止录音 */
  function stop() {
    audioCapture.stop()
    // 发送空 buffer 作为结束标记
    window.voicePipe.sendAudioChunk(new ArrayBuffer(0))
  }

  return { start, stop }
}
