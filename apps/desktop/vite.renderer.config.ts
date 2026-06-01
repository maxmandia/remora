import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  server: {
    port: 3001,
    strictPort: true,
  },
  plugins: [tailwindcss(), react()],
})
