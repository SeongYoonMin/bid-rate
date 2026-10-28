import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
})
