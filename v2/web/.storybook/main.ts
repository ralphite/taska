import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  staticDirs: ['./public'], // T457: the saved answers the real page runs on, and the shim that serves them
  addons: ['@storybook/addon-a11y', '@storybook/addon-themes', '@storybook/addon-mcp'],
  framework: { name: '@storybook/react-vite', options: {} },
  // the page's service worker is not Storybook's: leave the PWA plugin out of it
  viteFinal: (config) => ({
    ...config,
    plugins: (config.plugins || [])
      .flat()
      .filter((p) => !(p && typeof p === 'object' && 'name' in p && String(p.name).startsWith('vite-plugin-pwa'))),
  }),
}

export default config
