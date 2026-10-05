import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 单文件构建：把 JS / CSS / 字体(woff2) 全部内联进一个 dist/index.html，
// 方便直接双击预览，也方便分享。正式部署时可去掉 viteSingleFile，走常规多文件 + 视频直链。
export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  // 开发时把 /api 转给 Python 后端（容器里由 compose 设成 http://api:8000）
  server: {
    proxy: { '/api': process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000' },
  },
  build: {
    assetsInlineLimit: 100_000_000, // 把 woff2 等资源以 base64 内联
    cssCodeSplit: false,
    target: 'esnext',
  },
})
