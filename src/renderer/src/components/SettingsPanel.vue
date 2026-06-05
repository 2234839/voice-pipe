<script setup lang="ts">
/**
 * 设置面板
 * 包含快捷键、ASR 地址、热词编辑
 */
import { ref, watch } from 'vue'
import { useVoicePipe } from '../composables/use-voice-pipe'

const emit = defineEmits<{
  close: []
}>()

const { config, saveConfig, captureKey, openDevTools } = useVoicePipe()

/** 快捷键输入值 */
const hotkeyValue = ref('')
/** ASR 地址 */
const asrUrl = ref('')
/** 是否正在捕获快捷键 */
const capturing = ref(false)
/** 热词列表（用 ref 而非 reactive，避免 Proxy 导致结构化克隆失败） */
const hotwords = ref<Array<{ word: string; weight: number }>>([])
/** 是否已从 config 同步过 */
let configSynced = false

/** config 加载完成后同步到本地状态 */
watch(config, (c) => {
  if (!c.hotkey || configSynced) return
  configSynced = true
  hotkeyValue.value = String(c.hotkey ?? 'RightAlt')
  asrUrl.value = String(c.asrUrl ?? 'ws://127.0.0.1:10095')
  const hw = c.hotwords
  if (Array.isArray(hw) && hw.length > 0) {
    hotwords.value = hw.map(h => ({ word: String(h.word), weight: Number(h.weight) }))
  }
}, { immediate: true })
/** 新热词 */
const newWord = ref('')
/** 新热词权重 */
const newWeight = ref(20)

/** 捕获快捷键 */
async function startCapture() {
  capturing.value = true
  hotkeyValue.value = '按下快捷键...'
  const keyName = await captureKey()
  hotkeyValue.value = keyName || String(config.value.hotkey ?? 'RightAlt')
  capturing.value = false
}

/** 立即保存热词到主进程 */
function syncHotwords() {
  /** 深拷贝为普通对象数组，避免 Vue Proxy 导致结构化克隆失败 */
  const plain = hotwords.value.map(h => ({ word: h.word, weight: h.weight }))
  saveConfig({ hotwords: plain })
}

/** 添加热词（立即保存） */
function addHotword() {
  const word = newWord.value.trim()
  if (!word) return
  // 检查重复
  const existing = hotwords.value.find(h => h.word === word)
  if (existing) {
    existing.weight = newWeight.value
  } else {
    hotwords.value.push({ word, weight: newWeight.value })
  }
  newWord.value = ''
  newWeight.value = 20
  syncHotwords()
}

/** 删除热词（立即保存） */
function removeHotword(index: number) {
  hotwords.value.splice(index, 1)
  syncHotwords()
}

/** 点击热词回填到输入框进行编辑 */
function editHotword(index: number) {
  const hw = hotwords.value[index]
  if (!hw) return
  newWord.value = hw.word
  newWeight.value = hw.weight
  hotwords.value.splice(index, 1)
  syncHotwords()
}

/** 保存设置 */
function save() {
  saveConfig({
    hotkey: hotkeyValue.value,
    asrUrl: asrUrl.value,
    hotwords: hotwords.value.map(h => ({ word: h.word, weight: h.weight })),
  })
  emit('close')
}
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <button class="back-btn" @click="emit('close')">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"/>
        </svg>
        返回
      </button>
      <h2>设置</h2>
    </div>

    <div class="settings-body">
      <!-- 快捷键 -->
      <div class="setting-item">
        <label>快捷键</label>
        <input
          type="text"
          readonly
          :value="hotkeyValue"
          :class="{ capturing }"
          @focus="startCapture"
        />
        <small>点击输入框设置新的快捷键</small>
      </div>

      <!-- ASR 地址 -->
      <div class="setting-item">
        <label>FunASR 地址</label>
        <input type="text" v-model="asrUrl" />
      </div>

      <!-- 热词 -->
      <div class="setting-item">
        <label>热词</label>
        <div class="hotwords-list">
          <div v-for="(hw, index) in hotwords" :key="index" class="hotword-item" @click="editHotword(index)">
            <span class="hotword-word">{{ hw.word }}</span>
            <span class="hotword-weight">{{ hw.weight }}</span>
            <button class="hotword-remove" @click="removeHotword(index)">×</button>
          </div>
        </div>
        <div class="hotword-add">
          <input
            type="text"
            v-model="newWord"
            placeholder="输入热词..."
            class="hotword-input"
            @keydown.enter="addHotword"
          />
          <input
            type="number"
            v-model.number="newWeight"
            min="1"
            max="100"
            class="hotword-weight-input"
          />
          <button class="hotword-add-btn" @click="addHotword">添加</button>
        </div>
        <small>热词可提升特定词汇的识别准确率，权重越高优先级越高</small>
      </div>

      <!-- 操作按钮 -->
      <div class="setting-actions">
        <button class="btn-secondary" @click="openDevTools">开发者工具</button>
        <button class="btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  position: absolute;
  inset: 0;
  background: #1a1a2e;
  z-index: 10;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #0f3460;
  background: #16213e;
}

.settings-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
  margin: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #4ecca3;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}

.back-btn:hover {
  background: rgba(78, 204, 163, 0.1);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #a0a0a0;
  margin-bottom: 6px;
}

.setting-item input[type="text"],
.setting-item input[type="number"] {
  width: 100%;
  padding: 8px 10px;
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.setting-item input:focus {
  border-color: #4ecca3;
}

.setting-item input.capturing {
  border-color: #4ecca3;
  color: #4ecca3;
  text-align: center;
}

.setting-item small {
  display: block;
  font-size: 11px;
  color: #606080;
  margin-top: 4px;
}

/* 热词列表 */
.hotwords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.hotword-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.hotword-item:hover {
  border-color: #4ecca3;
}

.hotword-word {
  color: #e0e0e0;
}

.hotword-weight {
  color: #4ecca3;
  font-size: 11px;
}

.hotword-remove {
  background: none;
  border: none;
  color: #606080;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s;
}

.hotword-remove:hover {
  color: #e74c3c;
}

.hotword-add {
  display: flex;
  gap: 6px;
}

.hotword-add input[type="text"].hotword-input {
  flex: 1;
  min-width: 0;
  width: 0;
  padding: 6px 8px;
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  outline: none;
}

.hotword-add input[type="text"].hotword-input:focus {
  border-color: #4ecca3;
}

.hotword-add input[type="number"].hotword-weight-input {
  width: 40px;
  padding: 6px 4px;
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  outline: none;
  text-align: center;
}

.hotword-add input[type="number"].hotword-weight-input:focus {
  border-color: #4ecca3;
}

.hotword-add-btn {
  padding: 6px 12px;
  background: rgba(78, 204, 163, 0.15);
  border: 1px solid #4ecca3;
  border-radius: 4px;
  color: #4ecca3;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.hotword-add-btn:hover {
  background: rgba(78, 204, 163, 0.25);
}

/* 操作按钮 */
.setting-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 8px;
}

.btn-primary {
  padding: 8px 20px;
  background: #4ecca3;
  border: none;
  border-radius: 6px;
  color: #1a1a2e;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #3db892;
}

.btn-secondary {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #0f3460;
  border-radius: 6px;
  color: #a0a0a0;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.btn-secondary:hover {
  border-color: #4ecca3;
  color: #4ecca3;
}
</style>
