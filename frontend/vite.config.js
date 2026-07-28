import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/chat': 'http://127.0.0.1:8000',
      '/feedback': 'http://127.0.0.1:8000',
      '/telemetry': 'http://127.0.0.1:8000',
      '/traffic': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
    }
  }
})