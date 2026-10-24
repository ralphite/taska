import type { Meta, StoryObj } from '@storybook/react-vite'
import { SheetFrames } from '../../stories/sheetFixtures'
import { notSavedSheet } from './NotSaved'

const meta: Meta = { title: 'Components/Project/Not saved' }
export default meta
type Story = StoryObj

const on = { go: () => {}, retry: () => {}, drop: () => {} }

/** What did not go in: each can be sent again or let go; with more than one, all at once. */
export const List: Story = {
  render: () => (
    <SheetFrames
      height={420}
      look={{ pop: true }}
      parts={() =>
        notSavedSheet(
          [
            { sid: 'a', what: 'F12 marked done', why: 'Taska said no: it was archived', when: '14:02', go: '/p/taska/F12', canRetry: false },
            { sid: 'b', what: 'Reply to B03', why: 'Connection lost', when: '13:58', said: 'Keep the old filter', elsewhere: 'Home', canRetry: true },
            { sid: 'c', what: 'Comment on D4', why: 'Connection lost', when: 'Yesterday 22:10', canRetry: true },
          ],
          on,
        ) ?? { body: null }
      }
    />
  ),
}
