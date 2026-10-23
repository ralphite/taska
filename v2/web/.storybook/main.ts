import type { StorybookConfig } from '@storybook/react-vite'
import { readFileSync } from 'node:fs'

// T457: the page's body classes (index.html), for the component stories' frame
const BODY = /<body class="([^"]*)"/.exec(readFileSync(new URL('../index.html', import.meta.url), 'utf8'))?.[1] || ''

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  // T457: the saved answers the real page runs on, and the shim that serves them. T456: Storybook's own server gives
  // them under /storybook/, as a built Storybook has them, with the page from the source (app.mjs --dev)
  staticDirs: process.argv.includes('dev') ? [{ from: './public', to: '/storybook' }] : ['./public'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-themes', '@storybook/addon-mcp', 'storybook-addon-pseudo-states'],
  framework: { name: '@storybook/react-vite', options: {} },
  // the page's service worker is not Storybook's: leave the PWA plugin out of it
  viteFinal: (config) => ({
    ...config,
    // the built page and its live copy are not sources: a build or a ship must not reload the stories you look at
    server: {
      ...config.server,
      watch: {
        ...config.server?.watch,
        ignored: ['**/dist/**', '**/live/**', '**/test-results/**', '**/playwright-report/**'],
      },
    },
    define: { ...config.define, __PAGE_BODY__: JSON.stringify(BODY) },
    plugins: (config.plugins || [])
      .flat()
      .filter((p) => !(p && typeof p === 'object' && 'name' in p && String(p.name).startsWith('vite-plugin-pwa'))),
  }),
}

export default config
