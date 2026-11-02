import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    actions: { disable: true },
    // the most used first (B636): each folder's groups in the order you meet them; folders not named here follow
    // in alphabetical order
    options: {
      storySort: {
        order: [
          'Components',
          [
            'Conversation',
            [
              'Message',
              [
                'From you', ['Sent', 'Not there yet', 'Voice notes', 'Pictures, files, long words', 'Changed afterwards'],
                'From an agent', ['Kinds of message', 'Long messages', 'Pictures, voice, files', 'Who sent it', 'Pointer and hidden'],
                'Question', ['Answered', 'Changing the answer', 'Not answered with a choice'],
                'Document comment',
              ],
              'Whole conversation',
              'Message parts',
            ],
            'Input box',
            [
              'Writing', ['Words in it', 'Pointer on its buttons'],
              'What it writes to', ['A new input', 'A reply to an item', 'A comment on a document', 'Changing what you said'],
              'Voice', ['Recording', 'Writing it out', 'Maybe misheard', 'Cut short or nothing heard'],
              'Line after sending', ['On its way', 'Being handled', 'What it became', 'Undo and move'],
              'Commenting on a document', ['Picking what to comment on', 'Speaking a comment', 'Replies and choices', 'Sent and not sent'],
              '*',
            ],
            'Item page',
            [
              'Needs-you card', ['Waiting on you', 'While you answer', 'After you decided'],
              'By item status', ['Waiting on you', 'Being worked on', 'Finished', 'Rules'],
              '*',
            ],
            'Item list',
            [
              'Item row', ['By status', 'Pointer, keys and picking', 'Swiping on the phone', 'Subitems', 'What it shows'],
              'Needs-you row', ['By what it needs', 'What it shows', 'Pointer, keys and picking'],
              'Views', ['Views of Items', 'Archive and Rules', 'Empty, small, loading'],
              '*',
            ],
            'Drag and drop', ['Items', 'Projects'],
            'Inputs', ['New input page', ['Project name', 'Latest inputs'], 'Input card', ['Being handled', 'What it became', 'Failed, undone, edited', 'Long, and jumped to'], '*'],
            'Document', ['Commenting', ['Paragraphs', 'Selected words', 'Circle to select', 'Web pages'], 'Comment threads', ['Reading a thread', 'Your comments'], '*'],
            'Sidebar', ['The sidebar', 'A list open beside it', 'Folded to icons', 'A new project'],
            'Home page', ['Your projects', 'Searching', 'A new project', 'Deleted or missing projects'],
            'Menus and sheets',
            [
              'Item menu', ['By item', 'Its submenus', 'Opening it'],
              'Sheets',
              [
                'Command palette', 'Switch project', 'Keyboard shortcuts', 'Filters', 'An item: what it came from, what agents see',
                'An input: its words and history', 'Not saved', 'Sign in', 'The sheet itself',
              ],
              '*',
            ],
            'Settings',
            ['Projects', 'Notifications', 'Use on your phone', 'Voice spellings', 'Organizer', 'On the phone: Documents, Activity, Deleted', 'The page and its parts'],
            'Help',
            '*',
          ],
          '*',
        ],
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
