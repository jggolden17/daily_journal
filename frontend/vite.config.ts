import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative base path for Cloud Storage deployment
  // This ensures assets load correctly from any path
  base: process.env.VITE_BASE_PATH || './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

