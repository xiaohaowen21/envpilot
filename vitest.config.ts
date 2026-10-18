import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['electron/**/*.test.ts'],
    testTimeout: 15_000,
  },
})
