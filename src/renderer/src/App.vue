<script setup lang="ts">
/**
 * VoicePipe 主窗口根组件
 * 管理主视图/设置视图切换，监听主进程 IPC 指令
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVoicePipe } from './composables/use-voice-pipe'
import { useAudio } from './composables/use-audio'
import StatusBar from './components/StatusBar.vue'
import PartialText from './components/PartialText.vue'
import HistoryList from './components/HistoryList.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const { status, partialText, config, history, clearHistory } = useVoicePipe()
const audio = useAudio()

/** 是否显示设置面板 */
const showSettings = ref(false)

/** 全天候监听状态 */
const alwaysOn = ref(false)

/** 当前快捷键名称 */
const hotkeyName = computed(() => String(config.value.hotkey ?? 'RightAlt'))

/** 监听主进程的打开设置指令 */
function onOpenSettings() {
  showSettings.value = true
}

/** 监听主进程的开始录音指令 */
async function onStartRecording() {
  await audio.start()
}

/** 监听主进程的停止录音指令 */
function onStopRecording() {
  audio.stop()
}

onMounted(() => {
  window.voicePipe.onStartRecording(onStartRecording)
  window.voicePipe.onStopRecording(onStopRecording)
  window.addEventListener('open-settings', onOpenSettings)

  // 获取全天候监听状态
  window.voicePipe.getAlwaysOnStatus().then((active) => {
    alwaysOn.value = active
  })

  // 全天候采集控制（独立于热键，共享麦克风）
  window.voicePipe.onStartAlwaysOn(async () => {
    alwaysOn.value = true
    await audio.startAlwaysOn()
  })
  window.voicePipe.onStopAlwaysOn(() => {
    alwaysOn.value = false
    audio.stopAlwaysOn()
  })
})

onUnmounted(() => {
  window.removeEventListener('open-settings', onOpenSettings)
})
</script>

<template>
  <div id="app">
    <!-- 设置面板（覆盖整个窗口） -->
    <SettingsPanel
      v-if="showSettings"
      @close="showSettings = false"
    />

    <!-- 主视图 -->
    <template v-else>
      <StatusBar
        :status="status"
        :hotkey="hotkeyName"
        :always-on="alwaysOn"
        @open-settings="showSettings = true"
      />
      <PartialText :text="partialText" />
      <HistoryList
        :history="history"
        @clear="clearHistory"
      />
    </template>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
  user-select: none;
  -webkit-app-region: no-drag;
}

#app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}
</style>
