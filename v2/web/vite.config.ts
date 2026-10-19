/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The Python server (v2/server) answers the API; in development Vite serves the page and hands every
// API call, file and agent text request to it. TASKA_API picks the server (default: v2 on 7341).
const api = process.env.TASKA_API || 'http://127.0.0.1:7341'
const backend = { target: api, changeOrigin: false }

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false, // the server sends /manifest.webmanifest, as before
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: Number(process.env.TASKA_WEB_PORT || 5341),
    strictPort: true,
    proxy: {
      '/api': backend,
      '/health': backend,
      '/skill': backend,
      '/manifest.webmanifest': backend,
      '/login': backend,
      '^/k/': backend,
      // a project's API, files and agent text; the page's own views (/p/x/, /p/x/B03 ...) stay with Vite
      '^/p/[^/]+/(api|f|do|next|agent|rules|inbox|items|log|connect)(/|$|\\?)': backend,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
