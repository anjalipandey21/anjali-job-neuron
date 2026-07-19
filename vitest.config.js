import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    exclude: ['.worktrees/**', '**/node_modules/**'],
    environmentMatchGlobs: [
      ['netlify/functions/**', 'node'],
      ['src/**', 'jsdom'],
    ],
    server: {
      deps: {
        inline: [/@supabase/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'netlify/functions/**'],
    },
  },
})
