import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['storybook-addon-pseudo-states'],
  framework: { name: '@storybook/react-vite', options: {} },
  // a Demo's page shows the demo projects' pictures where Taska serves them (T589): files, not a server
  staticDirs: [{ from: './demo-data/shop/taska-files', to: '/p/shop/f' }],
  core: { disableTelemetry: true, allowedHosts: ['.ts.net'] }, // phones over tailscale serve (tailnet only; this machine's name stays out of the repo)
}
export default config
