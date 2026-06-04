/**
 * AudioWorklet 全局类型声明
 * AudioWorkletProcessor 和 registerProcessor 在 AudioWorklet 环境中是全局可用的
 */
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void
