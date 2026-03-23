import { defineConfig } from 'vitest/config'

export default defineConfig({
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
