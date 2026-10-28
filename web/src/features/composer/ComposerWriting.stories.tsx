// Writing in the input box: empty, with words, many lines,
// more than fits, its buttons under the pointer, focused. The page's own Composer on a list (a new input).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { boxAt, type Here } from '../../stories/boxFixtures'

export default { title: 'Components/Input box/Writing' } satisfies Meta
type Story = StoryObj

const at = (h: Here = {}, pseudo?: Record<string, string[]>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => boxAt(h, layout === 'desk')}</Frames>,
  ...(pseudo ? { parameters: { pseudo } } : {}),
})
const LINES = 'First line\nSecond line\nThird line'
const MANY = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: what I want the export to keep.`).join('\n')

export const Empty = at()
export const AFewWords = at({ text: 'Buy milk on the way home' })
export const ManyLines = at({ text: LINES })
export const LongerThanTheBoxItScrolls: Story = { ...at({ text: MANY }), name: 'Longer than the box: it scrolls' }
export const PointingAtTheMic = at({}, { hover: ['[aria-label="Record a voice note"]'] })
export const PointingAtSend = at({ text: 'Buy milk on the way home' }, { hover: ['[data-box="main"]'] })
export const PointingAtAdd: Story = { ...at({}, { hover: ['[aria-label="Add images or files"]'] }), name: 'Pointing at + (add pictures or files)' }
export const WritingInItFocused: Story = { ...at({}, { focus: ['textarea'], focusWithin: ['#composer', '[data-box]'] }), name: 'Writing in it (focused)' }
export const WritingInItWordsInIt: Story = { ...at({ text: 'Buy milk' }, { focus: ['textarea'], focusWithin: ['#composer', '[data-box]'] }), name: 'Writing in it, words in it' }
