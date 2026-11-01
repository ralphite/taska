/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

// The service worker is built with the page, at /sw.js, with this build's files written into it (what it keeps):
// the page's own code, not the parts it loads only when needed.
function serviceWorker(): Plugin {
  return {
    name: 'taska-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const sw = Object.values(bundle).find((c) => c.type === 'chunk' && c.name === 'sw')
      if (!sw || sw.type !== 'chunk') return
      const pub = readdirSync(fileURLToPath(new URL('./public', import.meta.url)))
      // the page's own code, not what it loads only when needed (Mermaid's diagrams: large, fetched the first time)
      const page = new Set<string>()
      const take = (f: string) => {
        const c = bundle[f]
        if (page.has(f) || !c || c.type !== 'chunk') return
        page.add(f)
        c.imports.forEach(take)
      }
      Object.values(bundle).forEach((c) => c.type === 'chunk' && c.isEntry && c !== sw && take(c.fileName))
      const files = [...Object.keys(bundle).filter((f) => f !== sw.fileName && (/\.js$/.test(f) ? page.has(f) : /\.(css|html|png|svg|woff2)$/.test(f))), ...pub.filter((f) => /\.(png|svg)$/.test(f)), 'index.html']
      sw.code = `const TASKA_SHELL=${JSON.stringify(files)};\n` + sw.code
    },
  }
}

// The Python server (server/) answers the API and agents; in development Vite serves the page and hands the rest
// to it. TASKA_API picks the server (default: the development server on 7341).
const api = process.env.TASKA_API || 'http://127.0.0.1:7341'
const backend = { target: api, changeOrigin: false }

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
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
      '^/p/[^/]+/(api|f|do|next|agent|rules|inbox|items|log|connect)(/|$|\\?)': backend,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: fileURLToPath(new URL('./index.html', import.meta.url)), sw: fileURLToPath(new URL('./src/worker/sw.ts', import.meta.url)) },
      output: { entryFileNames: (c) => (c.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js') },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
