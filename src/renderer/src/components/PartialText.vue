<script setup lang="ts">
/**
 * 实时识别文本显示
 * 录音/识别过程中显示 ASR 实时返回的文本
 */

/** 实时识别文本 */
defineProps<{
  /** 当前累积的识别文本 */
  text: string
}>()
</script>

<template>
  <div v-if="text" class="partial-text-container">
    <p class="partial-text">{{ text }}</p>
  </div>
</template>

<style scoped>
.partial-text-container {
  padding: 12px 14px;
  border-bottom: 1px solid #0f3460;
}

.partial-text {
  font-size: 14px;
  color: #e0e0e0;
  line-height: 1.5;
  word-break: break-all;
}
</style>
