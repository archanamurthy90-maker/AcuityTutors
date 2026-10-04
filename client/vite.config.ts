/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom + axe tests are memory-heavy; two workers and a generous timeout keep them stable on small machines.
    maxWorkers: 2,
    testTimeout: 30_000,
  },
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001',
    },
  },
})
