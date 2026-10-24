/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The Python server (app/server) answers the API and agents; in development Vite serves the page and hands the rest
// to it. TASKA_API picks the server (default: this version on 7351).
const api = process.env.TASKA_API || 'http://127.0.0.1:7351'
const backend = { target: api, changeOrigin: false }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.TASKA_WEB_PORT || 5351),
    strictPort: true,
    proxy: {
      '/api': backend,
      '/health': backend,
      '/skill': backend,
      '/manifest.webmanifest': backend,
      '/login': backend,
      '^/k/': backend,
      '^/p/[^/]+/(api|f|do|next|agent|rules|inbox|items|log|connect)(/|$|\\?)': backend,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
