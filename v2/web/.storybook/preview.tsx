import type { Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import '../src/index.css'
import { bump } from '../src/lib/state'
import { PageFrame, serveFiles, taskaLoader } from '../src/stories/lib/demo'

declare const __PAGE_BODY__: string

// T457: Components (every component in every state, on the demo project's data), Pages (the real page), Demo (the
// real page, played), Prototype (designs not built yet). Every story on the desktop (1440 wide) or the phone (393),
// light or dark, from the toolbar.

// the page's body, without what makes it a fixed frame: its colours, type and the pressed / focus rules
const BODY = __PAGE_BODY__
  .split(/\s+/)
  .filter((c) => !/^(h-dvh|overflow-hidden|lg:flex)$/.test(c))
  .join(' ')

serveFiles()

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
            ['By item status', 'By what it holds', 'Layout and editing', 'Needs-you card'],
            'Conversation',
            ['Message', 'Whole conversation', 'Message parts'],
            'Input box',
            ['Writing', 'Pictures', 'Voice', 'Line after sending'],
            'Inputs',
            ['Inputs tab', 'Input card', 'New input page', 'On its way'],
            'Document',
            ['Reading', 'Commenting', 'Choices', 'Editing'],
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
          ['Desktop', 'Phone'],
          'Demo',
          'Prototype',
        ],
      },
    },
  },
  globalTypes: {
    scheme: {
      description: 'Light or dark',
      toolbar: { title: 'Scheme', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { scheme: 'light', viewport: { value: 'desktop', isRotated: false } },
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
      return ctx.title.startsWith('Components/') ? (
        <PageFrame>
          <Story />
        </PageFrame>
      ) : (
        <Story />
      )
    },
  ],
}

export default preview
