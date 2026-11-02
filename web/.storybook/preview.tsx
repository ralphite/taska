import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    actions: { disable: true },
    // the most used first (B636): the conversation, its messages from you, then the agent's, its questions, comments
    options: {
      storySort: {
        order: ['Components', ['Conversation', ['Message', ['From you', 'From an agent', 'Question', 'Document comment'], 'Whole conversation', 'Message parts'], '*'], '*'],
      },
    },
  },
  // light or dark from the toolbar, one at a time (R598): the page's own dark variant follows data-theme on <html>
  globalTypes: {
    theme: { description: 'Light or dark', toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true } },
  },
  initialGlobals: { theme: 'light' },
  decorators: [withThemeByDataAttribute({ themes: { light: 'light', dark: 'dark' }, defaultTheme: 'light', attributeName: 'data-theme' })],
}
export default preview
