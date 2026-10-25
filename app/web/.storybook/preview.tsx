import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    actions: { disable: true },
  },
  // light or dark from the toolbar, one at a time (R598): the page's own dark variant follows data-theme on <html>
  decorators: [withThemeByDataAttribute({ themes: { light: 'light', dark: 'dark' }, defaultTheme: 'light', attributeName: 'data-theme' })],
}
export default preview
