import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.{ts,tsx,vue}'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**'],
      reportsDirectory: './coverage/unit',
    },
    environment: 'node',
  },
})
