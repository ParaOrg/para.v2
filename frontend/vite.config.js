import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/chat': 'http://127.0.0.1:8000',
      '/feedback': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
      '/api/v1': 'http://127.0.0.1:8000',
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
