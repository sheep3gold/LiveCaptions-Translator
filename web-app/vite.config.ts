import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3020,
    strictPort: true,  // 如果端口被占用则报错，不自动切换
    host: '0.0.0.0',   // 允许外部访问
    allowedHosts: ['caishi-a.hsk.top', 'localhost', '127.0.0.1'],  // 允许的域名
    proxy: {
      '/api': {
        target: 'http://localhost:3020',
        changeOrigin: true
      }
    }
  }
})

