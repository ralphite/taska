import type { Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import '../src/index.css'
import { bump } from '../src/lib/state'
import { taskaLoader } from '../src/stories/lib/demo'
import { AppFrame } from '../src/components/Shell'
import { Both, single, type Platform } from '../src/stories/lib/both'

declare const __PAGE_BODY__: string

// T457: Components (every component in every state, on the demo project's data), Pages (the real page), Demo (the
// real page, played), Prototype (designs not built yet). Every story on the desktop (1440 wide) or the phone (393),
// light or dark from the toolbar's one button.

// the page's body, without what makes it a fixed frame: its colours, type and the pressed / focus rules
const BODY = __PAGE_BODY__
  .split(/\s+/)
  .filter((c) => !/^(h-dvh|overflow-hidden|lg:flex)$/.test(c))
  .join(' ')

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        phone: { name: 'iPhone 393x852', styles: { width: '393px', height: '852px' } },
        desktop: { name: 'Desktop 1440x900', styles: { width: '1440px', height: '900px' } },
      },
    },
    options: {
      // T512, B515: what is used most first, then the rest; stories in each folder as their file lists them
      storySort: {
        order: [
          'Components',
          [
            'Item list',
            ['Views', 'Search and filters', 'Picking and going through', 'Item row', 'Needs-you row', 'Agent mark'],
            'Item page',
            ['By item status', 'By what it holds', 'Layout and editing', 'Needs-you card', 'Loading and empty'],
            'Conversation',
            [
              'Message',
              ['From an agent', 'From you', 'Question', 'Document comment'],
              'Whole conversation',
              'Message parts',
            ],
            'Input box',
            ['Writing', 'Voice', 'What it writes to', 'Pictures and files', 'Line after sending'],
            'Inputs',
            ['Inputs tab', 'Input card', 'New input page', 'On its way'],
            'Document',
            ['Reading', 'Commenting', 'Comment threads', 'Choices', 'Editing'],
            'Menus and sheets',
            ['Item menu', 'Other menus', 'Move and pick', 'Sheets'],
            'Top bar and list head',
            ['Project bar', 'List head', 'Tabs', 'Agent pill', 'Filters'],
            'Sidebar',
            'Floating',
            ['Toast', 'Picture viewer', 'Tip'],
            'Settings',
            'Side lists',
            'Home page',
            'Icons and marks',
            ['Icons', 'Item status icon', 'Keys', 'Project tile', 'Agent avatar', 'Search hit'],
          ],
          'Pages',
          [
            'Item list',
            'Item page',
            ['By item status', 'By what it holds'],
            'Document',
            'Inputs',
            'Projects',
            'Settings',
            'Side lists',
            'Dev',
          ],
          'Demo',
          [
            'New input',
            'Voice',
            'Needs you',
            'Item list',
            'Item changes',
            'Item page',
            'Document',
            'Phone gestures',
            'Projects',
            'Settings',
            'Side lists',
            'Sync and errors',
            'Agents',
            'Keyboard',
          ],
          'Prototype',
        ],
      },
    },
  },
  globalTypes: {
    // light or dark: switched by one button in the toolbar (manager.tsx, F528)
    scheme: { description: 'Light or dark' },
  },
  initialGlobals: { scheme: 'light' },
  loaders: [taskaLoader],
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.scheme === 'dark' ? 'dark' : 'light'
      document.documentElement.style.colorScheme = theme
      document.documentElement.dataset.theme = theme
      document.body.className = BODY
      useEffect(() => {
        // the phone or the desktop picked in the toolbar: the parts that ask "is this the desktop?" draw again
        const again = () => bump()
        addEventListener('resize', again)
        // a story is a picture of the page: its links do not leave Storybook
        const stay = (e: MouseEvent) => {
          const a = (e.target as Element).closest?.('a[href]')
          if (a && !a.closest('[data-story-links]')) e.preventDefault()
        }
        document.addEventListener('click', stay, true)
        return () => {
          removeEventListener('resize', again)
          document.removeEventListener('click', stay, true)
        }
      }, [])
      if (!ctx.title.startsWith('Components/')) return <Story />
      // T518 (#6195): a component on the desktop and the phone at once; each frame draws the story itself
      if (!single()) return <Both id={ctx.id} scheme={theme} platform={ctx.parameters.platform as Platform} />
      return (
        <AppFrame>
          <Story />
        </AppFrame>
      )
    },
  ],
}

export default preview
