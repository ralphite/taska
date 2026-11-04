import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    // no controls; the Actions panel logs each click on a story's menus and buttons (D115 #16: stories pass act())
    controls: { disable: true },
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
                'From you', ['Sending, or not sent', 'Sent', 'Voice notes', 'Pictures, files, long words', 'Changed afterwards'],
                'From an agent', ['Kinds of message', 'Long messages', 'Pictures, voice, files', 'Who sent it', 'Pointer and hidden'],
                'Question', ['Answered', 'Changing the answer', 'Not answered with a choice'],
                'Document comment',
              ],
              'Whole conversation',
              'Message parts', ['Words', 'Voice notes, pictures, files'],
            ],
            'Input box',
            [
              'Writing', ['Words in it', 'Pointer on its buttons'],
              'What it writes to', ['A new input', 'A reply to an item', 'A comment on a document', 'Changing what you said'],
              'Voice', ['Recording', 'Writing it out', 'Maybe misheard', 'Cut short or nothing heard'],
              'Line after sending', ['On its way', 'Being handled', 'What it became', 'Undo and move'],
              'Commenting on a document', ['Picking what to comment on', 'Speaking a comment', 'Replies and choices', 'Sent and not sent'],
              'Pictures and files',
              'Draft card',
              'Bar over selected words',
            ],
            'Item page',
            [
              'Needs-you card', ['A question', 'To approve or accept', 'While you answer', 'After you decided'],
              'By item status', ['Waiting on you', 'Being worked on', 'Finished', 'Rules'],
              'By what it holds',
              'Editing and replying',
              'Document card',
              'Its bar',
              'Layout',
              'Loading and empty',
            ],
            'Item list',
            [
              'Item row',
              [
                'By status',
                [
                  'Still to do',
                  ['Open', 'Next in the queue', 'Open, you replied', 'In progress', 'In progress: the agent at work, its name in the tip', 'Waits for review', 'Later'],
                  'Finished, and rules',
                ],
                'Pointer, keys and picking', ['Pointer on it', 'Open, picked, dragged'],
                'Swiping on the phone', ['Forward', 'Back', 'Rules and archived rows'],
                'Subitems',
                'What it shows',
              ],
              'Needs-you row', ['By what it needs', 'What it shows', 'Pointer, keys and picking'],
              'Views', ['The Items tab’s views', 'Your own views, sorting', 'Archive and Rules', 'Empty, small, loading'],
              'View chips',
              'Search and filters',
              'Picked, folded, just acted on',
              'Bar for picked items',
              'Lines between rows',
              'Dragging items',
            ],
            'Inputs',
            [
              'New input page', ['The whole page', 'Latest inputs', ['The list', 'One on its way or being handled'], 'Project name'],
              'Inputs tab',
              'Input card',
              ['Being handled', 'What it became', ['Filed by the organizer', 'Left for an agent', 'An answer, or moved away'], 'Failed, undone, edited', 'Long, and jumped to'],
              'On its way',
            ],
            'Search on the phone', ['Walk through', 'Say and search', 'Say more or change it', 'When it goes wrong'],
            'Document',
            [
              'Reading',
              'Its bar, the pointer on it',
              'Commenting', ['Paragraphs', 'Selected words', 'Circle to select', 'Web pages'],
              'Comment threads', ['Reading a thread', 'Your comments'],
              'Choices',
              'Editing',
              'On the phone',
            ],
            'Around the page',
            [
              'Sidebar', ['The sidebar', 'A list open beside it', 'Folded to icons', 'A new project', 'Dragging projects'],
              'Side lists',
              [
                'Documents',
                'Activity',
                ['What happened', 'A change picked', 'Pointer on your change: Undo', 'Undo asks again', 'Earlier changes loading', 'Loading', 'Nothing happened yet', 'Each kind of line'],
                'Deleted',
              ],
              'Top bar and list head', ['Project bar', 'Tabs', 'List head', 'Filters', 'Agent pill'],
              'Home page', ['Your projects', 'Searching', 'A new project', 'Deleted or missing projects'],
              'Menus and sheets',
              [
                'Item menu', ['By item', 'Its submenus', 'Opening it'],
                'What you said: its menu',
                'Other menus',
                'Move and pick',
                'Sheets',
                [
                  'Command palette', 'Switch project', 'Keyboard shortcuts', 'Filters on the phone', 'An item: what it came from, what agents see',
                  'An input: its words and history', 'Not saved, sign in', 'The sheet itself',
                ],
                'Agents', ['Who works here', 'What an agent reads'],
              ],
              'Floating', ['Tip', ['On buttons', 'On codes and voice notes'], 'Toast', 'Picture viewer'],
            ],
            'Settings, help and parts',
            [
              'Settings',
              [
                'Projects',
                'Notifications', ['In this browser', 'On the phone'],
                'Use on your phone',
                'Voice spellings',
                'Organizer',
                'On the phone: Documents, Activity, Deleted', ['Documents', 'Activity', 'Deleted'],
                'The page and its parts',
              ],
              'Help', ['Topics', 'Searching'],
              'Icons and marks',
              'Dev', ['Dashboard', 'Links in the sidebar'],
              'About this section',
            ],
          ],
          'Prototype', ['About this section', 'F479 Search on the desktop', ['Walk through', 'Type and find', 'Filters and actions', 'Say it', 'When it goes wrong, dark, narrower']],
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
