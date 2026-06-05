<script setup lang="ts">
/**
 * 历史识别结果列表
 * 显示最近的识别记录，支持复制和清空
 */
import type { HistoryEntry } from '../composables/use-voice-pipe'

/** 触发清空历史 */
const props = defineProps<{
  /** 历史记录列表 */
  history: HistoryEntry[]
}>()

const emit = defineEmits<{
  clear: []
}>()

/** 格式化时间 */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 格式化日期（跨天时显示） */
function formatDate(ts: number): string {
  const d = new Date(ts)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return ''
  return `${month}/${day} `
}

/** 复制文本到剪贴板 */
async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}
</script>

<template>
  <div class="history-list">
    <div class="history-header">
      <span class="history-title">识别历史</span>
      <button v-if="history.length > 0" class="clear-btn" @click="emit('clear')">
        清空
      </button>
    </div>

    <div v-if="history.length === 0" class="history-empty">
      暂无识别记录
    </div>

    <div v-else class="history-items">
      <div
        v-for="(entry, index) in history"
        :key="index"
        class="history-item"
      >
        <div class="history-content">
          <div class="history-text">{{ entry.text }}</div>
          <div class="history-time">{{ formatDate(entry.timestamp) }}{{ formatTime(entry.timestamp) }}</div>
        </div>
        <button class="copy-btn" @click="copyText(entry.text)" title="复制文本">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 6px;
}

.history-title {
  font-size: 12px;
  font-weight: 600;
  color: #a0a0a0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.clear-btn {
  font-size: 11px;
  color: #a0a0a0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: color 0.15s, background 0.15s;
}

.clear-btn:hover {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

.history-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606080;
  font-size: 13px;
}

.history-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px 10px;
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  transition: background 0.12s;
  margin-bottom: 4px;
}

.history-item:hover {
  background: rgba(78, 204, 163, 0.06);
}

.history-content {
  flex: 1;
  min-width: 0;
  user-select: text;
}

.history-text {
  font-size: 13px;
  color: #e0e0e0;
  line-height: 1.4;
  word-break: break-all;
}

.history-time {
  font-size: 11px;
  color: #606080;
  margin-top: 2px;
}

.copy-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #606080;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}

.history-item:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  color: #4ecca3;
  background: rgba(78, 204, 163, 0.1);
}
</style>
