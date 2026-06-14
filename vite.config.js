import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,  // ECharts 包大是已知现象, 提高告警阈值
  },
  server: {
    port: 3000,
    open: false,
  },
})
