# VoicePipe — Windows 语音输入工具

> 按住快捷键 → 说话 → 松开 → 文字自动粘贴到当前光标位置

## 它解决什么问题

中文语音输入的痛点：市面上的方案要么体积臃肿（讯飞输入法 500MB+），要么需要联网（隐私风险），要么体验割裂（先打开 APP → 录音 → 复制 → 切回 → 粘贴）。

VoicePipe 的思路：**一个快捷键，一条管道**。按住说话，松开粘贴。不窃取数据，不依赖云端，不需要额外窗口。

## 工作流程

```
┌──────────────────────────────────────────────────────────────────┐
│  用户按住快捷键（默认 RightAlt）                                   │
│       ↓                                                          │
│  Web Audio API 采集麦克风 → PCM 16kHz 16bit mono                 │
│       ↓                                                          │
│  用户松开快捷键                                                    │
│       ↓                                                          │
│  PCM 编码 WAV → 通过 WebSocket 发送到 FunASR（本地 Docker）        │
│       ↓                                                          │
│  FunASR 返回转写文本                                              │
│       ↓                                                          │
│  文本写入剪贴板 → 触发 Ctrl+V 粘贴                                │
│       ↓                                                          │
│  当前光标位置出现文字 ✓                                            │
└──────────────────────────────────────────────────────────────────┘
```

## 技术方案：Electron + electron-vite

| 需求 | 方案 | 说明 |
|------|------|------|
| 构建工具 | **electron-vite** | 三进程统一构建 + HMR |
| 全局快捷键 | **uiohook-napi** | 支持 keydown/keyup 事件 + keyTap 模拟粘贴 |
| 麦克风采集 | **Web Audio API** | 渲染进程 getUserMedia + AudioWorklet |
| ASR 转写 | **FunASR WebSocket** | 离线模式，ws 库连接 |
| 剪贴板 | **Electron clipboard** | 内置 API |
| 粘贴触发 | **uiohook-napi keyTap** | 模拟 Ctrl+V |
| 配置管理 | **electron-store** | 持久化配置 |
| 系统托盘 | **Electron Tray** | 内置 API |
| 打包分发 | **electron-builder** | Windows NSIS 安装程序 |

## 项目结构

```
voice-pipe/
  electron.vite.config.ts          # electron-vite 构建配置
  electron-builder.yml             # 打包配置
  tsconfig.json                    # TypeScript 项目引用
  tsconfig.node.json               # 主进程 + preload 类型配置
  tsconfig.web.json                # 渲染进程类型配置
  package.json
  locales/
    zh.json                        # 中文 UI 文本
  resources/
    icon.ico                       # 托盘图标（就绪状态）
    icon-recording.ico             # 录音状态图标
    icon-processing.ico            # 识别中状态图标
  src/
    main/                          # 主进程（Node.js 环境）
      index.ts                     # 入口：窗口 + 托盘 + 生命周期 + 状态机
      hotkey.ts                    # uiohook-napi 全局快捷键
      paster.ts                    # 剪贴板写入 + Ctrl+V 触发
      asr-client.ts                # FunASR WebSocket 客户端
      wav-encoder.ts               # PCM → WAV 编码（手写 44-byte header）
      config.ts                    # electron-store 配置管理
      tray.ts                      # 系统托盘
    preload/
      index.ts                     # contextBridge IPC 桥接
    renderer/                      # 渲染进程（浏览器环境）
      index.html                   # 主页面
      src/
        main.ts                    # 渲染进程入口
        audio-capture.ts           # getUserMedia + AudioWorklet 采集
        pcm-processor.ts           # AudioWorklet 降采样 + 格式转换
        settings.ts                # 设置界面逻辑
        preload.d.ts               # IPC 类型声明
        audio-worklet.d.ts         # AudioWorklet 类型声明
        style.css                  # 界面样式
```

## 核心状态机

```
IDLE → (RightAlt 按下) → RECORDING → (RightAlt 松开) → PROCESSING → (完成/失败) → IDLE
```

- **IDLE**: 等待快捷键按下
- **RECORDING**: 通知渲染进程开始音频采集
- **PROCESSING**: 停止采集 → PCM 编码 WAV → FunASR 转写 → 剪贴板 → 粘贴

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（HMR）
pnpm dev

# 类型检查
pnpm typecheck

# 构建
pnpm build

# 打包 Windows 安装程序
pnpm build:win
```

## FunASR 依赖

VoicePipe 需要 FunASR 作为本地 ASR 服务：

```bash
# 启动 FunASR Docker（沿用 sy2video 部署）
cd /path/to/sy2video/docker/funasr && docker compose up -d

# 默认地址
ws://127.0.0.1:10095
```

## 配置

通过设置界面修改，存储在 electron-store：

```json
{
  "hotkey": "RightAlt",
  "asrUrl": "ws://127.0.0.1:10095",
  "notification": true
}
```

支持的快捷键：`RightAlt`、`Alt`、`RightCtrl`、`Ctrl`、`F8`、`F9`、`F10`

## 相关项目

- **sy2video** — 思源笔记转视频，复用其 FunASR Docker 部署和 ASR 协议
- **FunASR** — 阿里达摩院离线语音识别，Docker 本地部署
- **electron-vite** — Electron 专用 Vite 构建工具

## 许可

MIT
