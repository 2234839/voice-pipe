<script setup lang="ts">
/**
 * 状态指示栏
 * 显示当前状态（就绪/录音中/识别中）、全天候监听状态和设置按钮
 */
import { computed } from 'vue'

/** 当前状态 */
const props = defineProps<{
  /** 应用状态 */
  status: string
  /** 当前快捷键名称 */
  hotkey: string
  /** 全天候监听是否开启 */
  alwaysOn: boolean
}>()

/** 触发打开设置 */
const emit = defineEmits<{
  openSettings: []
}>()

/** 状态文案映射 */
const statusTexts: Record<string, string> = {
  idle: '就绪',
  recording: '录音中...',
  processing: '识别中...',
}

/** 状态提示文案 */
const hintTexts: Record<string, string> = {
  idle: `按住 ${props.hotkey} 开始说话`,
  recording: '正在聆听...',
  processing: '等待识别结果...',
}

/** 状态文案 */
const statusLabel = computed(() => statusTexts[props.status] ?? props.status)
const hintLabel = computed(() => {
  const hint = hintTexts[props.status] ?? ''
  if (props.alwaysOn && props.status === 'idle') {
    return `${hint} · 全天候监听中`
  }
  return hint
})
</script>

<template>
  <div class="status-bar" :class="`status-${status}`">
    <div class="status-left">
      <div class="status-dot" :class="{ 'always-on': alwaysOn && status === 'idle' }" />
      <div class="status-info">
        <span class="status-label">{{ statusLabel }}</span>
        <span class="status-hint">{{ hintLabel }}</span>
      </div>
    </div>
    <button class="settings-btn" title="设置" @click="emit('openSettings')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
        <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4ecca3;
  flex-shrink: 0;
}

.status-idle .status-dot {
  background: #4ecca3;
}

.status-dot.always-on {
  background: #3498db;
  animation: pulse 2s ease-in-out infinite;
}

.status-recording .status-dot {
  background: #e74c3c;
  animation: pulse 1.2s ease-in-out infinite;
}

.status-processing .status-dot {
  background: #f39c12;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.status-label {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
}

.status-hint {
  font-size: 11px;
  color: #a0a0a0;
}

.settings-btn {
  background: none;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}

.settings-btn:hover {
  color: #4ecca3;
  background: rgba(78, 204, 163, 0.1);
}
</style>
