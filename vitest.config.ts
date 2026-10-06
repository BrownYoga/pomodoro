import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
}))
