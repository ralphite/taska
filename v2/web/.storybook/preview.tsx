import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

// Every component is looked at on the phone (393 wide) and the desktop (1440 wide), light and dark.
const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        phone: { name: 'iPhone 393x852', styles: { width: '393px', height: '852px' } },
        desktop: { name: 'Desktop 1440x900', styles: { width: '1440px', height: '900px' } },
      },
    },
  },
  globalTypes: {
    scheme: {
      description: 'Light or dark',
      toolbar: { title: 'Scheme', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { scheme: 'light' },
  decorators: [
    (Story, ctx) => {
      document.documentElement.style.colorScheme = ctx.globals.scheme === 'dark' ? 'dark' : 'light'
      document.documentElement.dataset.theme = ctx.globals.scheme === 'dark' ? 'dark' : 'light'
      return <Story />
    },
  ],
}

export default preview
