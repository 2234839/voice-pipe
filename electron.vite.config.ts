import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['uiohook-napi']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          indicator: resolve(__dirname, 'src/preload/indicator.ts'),
        },
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          indicator: resolve(__dirname, 'src/renderer/indicator.html'),
        },
      },
    },
  },
})
