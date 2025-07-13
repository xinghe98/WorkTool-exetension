import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'

// 自定义插件：处理manifest.json中的路径
function manifestPlugin() {
  return {
    name: 'manifest-plugin',
    writeBundle() {
      // 读取构建后的manifest.json
      const manifestPath = resolve(__dirname, 'dist/manifest.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      
      // 修复content script路径
      if (manifest.content_scripts && manifest.content_scripts.length > 0) {
        manifest.content_scripts[0].js = ['assets/content.js']
      }
      
      // 写回文件
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), manifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

