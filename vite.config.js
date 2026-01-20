import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'https://video-call-app-backend.onrender.com',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
