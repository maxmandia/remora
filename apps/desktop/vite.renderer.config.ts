import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(appDir, '../..')

export default defineConfig({
  root: 'src/renderer',
  base: './',
  server: {
    port: 3001,
    strictPort: true,
    fs: {
      allow: [monorepoRoot],
    },
    watch: {
      ignored: ['**/node_modules/**', '!**/node_modules/@remora/**'],
    },
  },
  plugins: [tailwindcss(), react()],
})
