import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'  // <- THIS is correct for the new plugin

export default defineConfig({
  plugins: [react(), tailwind()],        // <- call the imported variable
})
