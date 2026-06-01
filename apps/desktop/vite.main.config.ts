import { defineConfig } from 'vite'
import { builtinModules } from 'node:module'

const external = [
  'electron',
  'electron/main',
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: '.vite/main',
    target: 'node22',
    lib: {
      entry: 'src/main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external,
    },
  },
  resolve: {
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
})
