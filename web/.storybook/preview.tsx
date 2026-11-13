import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    // no controls; the Actions panel logs each click on a story's menus and buttons (D115 #16: stories pass act())
    controls: { disable: true },
    // by the page's design (T701, D122): Base components are the parts used everywhere; UI is each place on the page,
    // left to right, top to bottom, and in each place its parts in the order you meet them (B636); then Demo (what
    // the product does, played on the real page: T589, D124), Prototype and Review. A folder's own stories come before
    // its folders; folders not named here keep their files' order
    options: {
      storySort: {
        order: [
          'Base components',
          [
            'Buttons',
            'Status icons and marks', ['Icons', 'Item status icon', 'Keys', 'Project tile', 'Search hit', 'Other marks'],
            'Avatars',
            'Menus',
            'Sheets',
            'Toasts',
            'Tips', ['On buttons', 'On codes and voice notes'],
            'Markdown',
            'Voice note and files',
            'Recording strip',
          ],
          'UI',
          [
            'Left sidebar',
            [
              'Whole', ['Folded to icons'],
              'Brand area',
              'New input button',
              'Projects list', ['Project item', 'Dragging projects', 'A new project'],
              'Bottom links',
              'A list open beside it',
              [
                'Documents',
                'Activity',
                ['What happened', 'A change picked', 'Pointer on your change: Undo', 'Undo asks again', 'Earlier changes loading', 'Loading', 'Nothing happened yet', 'Each kind of line'],
                'Deleted',
              ],
            ],
            'Home page', ['Your projects', 'Searching', 'A new project', 'Deleted or missing projects'],
            'List pane',
            [
              'Top bar', ['Project bar', 'Agent pill', ['Agents', 'What agents read'], 'List head'],
              'View tabs', ['Tabs', 'View chips'],
              'Filters',
              'Item row',
              [
                'By status',
                [
                  'Still to do',
                  ['Open', 'Next in the queue', 'Open, you replied', 'In progress', 'In progress: the agent at work, its name in the tip', 'Waits for review', 'Later'],
                  'Finished',
                ],
                'Pointer, keys and picking', ['Pointer on it', 'Open, picked, dragged'],
                'Phone: Swiping', ['Forward', 'Back', 'Rules and archived rows'],
                'Subitems',
                'What it shows',
              ],
              'Needs-you row', ['By what it needs', 'What it shows', 'Pointer, keys and picking'],
              'Group heads',
              'Picked, folded, just acted on',
              'Selection bar',
              'Views', ["The Items tab's views", 'Your own views, sorting', 'Archive', 'Filtered'],
              'Empty list',
              'Dragging items',
            ],
            'Rules tab', ['Screens', 'Parts', 'Restored'],
            'Item pane',
            [
              'Bar',
              'Whole',
              [
                'By item status', ['Waiting on you', 'Being worked on', 'Finished', 'Rules'],
                'By what it holds',
                'Editing and replying',
                'Loading and empty',
              ],
              'Talk',
              [
                'Needs-you card', ['A question', 'To approve or accept', 'While you answer', 'After you decided'],
                'Message',
                [
                  'From you', ['Sending, or not sent', 'Sent', 'Voice notes', 'Pictures, files, long words', 'Changed afterwards'],
                  'From an agent', ['Kinds of message', 'Long messages', 'Pictures, voice, files', 'Who sent it', 'Pointer and hidden'],
                  'Question', ['Answered', 'Changing the answer', 'Not answered with a choice'],
                  'Document comment',
                  'Its menu',
                ],
                'Whole conversation',
              ],
              'Documents on it',
              'Item menu', ['By item', 'Its submenus', 'Opening it'],
              'An item: what it came from, what agents see',
              'Layout',
            ],
            'Document pane',
            [
              'Its bar, the pointer on it',
              'Reading',
              'Commenting', ['Paragraphs', 'Selected words', 'Circle to select', 'Voice and words on a place', 'Web pages', 'Phone'],
              'Comment threads', ['Reading a thread', 'Your comments'],
              'Choices',
              'Editing',
            ],
            'Input box',
            [
              'Writing', ['Words in it', 'Pointer on its buttons'],
              'What it writes to', ['A new input', 'A reply to an item', 'A comment on a document', 'Changing what you said'],
              'Voice', ['Whole workflow', 'Recording', 'Writing it out', 'Maybe misheard', 'Cut short or nothing heard'],
              'Line after sending', ['On its way', 'Being handled', 'What it became', 'Move and filing undone'],
              'Commenting on a document', ['Picking what to comment on', 'Speaking a comment', 'Replies and choices', 'Sent and not sent'],
              'Pictures and files',
              'Draft card',
              'Bar over selected words',
            ],
            'Inputs page',
            [
              'New input page', ['The whole page', 'Latest inputs', ['The list', 'One on its way or being handled'], 'Project name'],
              'Inputs tab',
              'Input row',
              ['Being handled', 'What it became', ['Filed by the organizer', 'Left for an agent', 'An answer, or moved away'], 'Failed, undone, edited', 'Long, and jumped to'],
              'On its way',
              'Its menu',
              'Its words and history',
            ],
            'Search',
            [
              'Desktop dialog', ['Walk through', 'Type and find', 'Filters and actions', 'Say it', 'When it goes wrong, dark, narrower'],
              'Phone page', ['Walk through', 'Say and search', 'Say more or change it', 'When it goes wrong'],
            ],
            'Settings and help',
            [
              'Settings',
              [
                'Projects',
                'Notifications', ['In this browser', 'Phone'],
                'Use on your phone',
                'Voice spellings',
                'Organizer',
                'The page and its parts',
              ],
              'Help', ['Topics', 'Searching'],
              'Dev dashboard',
            ],
            'Phone only',
            'Floating', ['Picture viewer', 'Switch project', 'Keyboard shortcuts', 'Not saved, sign in'],
            'About this section',
          ],
          'Demo',
          'Prototype', ['About this section'],
          'Review', ['About this section'],
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
