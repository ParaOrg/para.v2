import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/route-search': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': 'https://para-ph-api.onrender.com',
      '/chat': 'https://para-ph-api.onrender.com',
      '/feedback': 'https://para-ph-api.onrender.com',
      '/telemetry': 'https://para-ph-api.onrender.com',
      '/traffic': 'https://para-ph-api.onrender.com',
      '/auth': 'https://para-ph-api.onrender.com',
      '/poi': 'https://para-ph-api.onrender.com',
      '/commute': 'https://para-ph-api.onrender.com',
      '/routes': 'https://para-ph-api.onrender.com',
      '/fare': 'https://para-ph-api.onrender.com',
      '/community': 'https://para-ph-api.onrender.com',
      '/cities': 'https://para-ph-api.onrender.com',
      '/articles': 'https://para-ph-api.onrender.com',
    }
  }
})
