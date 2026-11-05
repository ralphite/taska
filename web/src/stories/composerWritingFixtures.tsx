// The helpers ComposerWriting's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { boxAt, type Here } from './boxFixtures'

type Story = StoryObj

export const at = (h: Here = {}, pseudo?: Record<string, string[]>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => boxAt(h, layout === 'desk')}</Frames>,
  ...(pseudo ? { parameters: { pseudo } } : {}),
})
export const LINES = 'The export should keep:\n- the filter\n- the sort'
export const MANY = [
  'What the export should keep, from the orders page:',
  '- the status filter (Paid, Refunded, Cancelled)',
  '- the date range, including a custom one',
  '- the sort, and which way it goes',
  '- the columns I hid',
  '- the column order I dragged them into',
  '- the search words, if any',
  'And the file itself:',
  '- its name says the filter and the dates',
  '- dates in the format from Settings',
  '- totals as numbers Excel can add up',
  '- refunds as their own rows',
  'On the phone the same, and Export has to actually do something there.',
  'If nothing matches, say so instead of writing an empty file.',
].join('\n')
