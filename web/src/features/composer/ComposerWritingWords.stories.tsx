// The box empty, with a few words, many lines, longer than the box, focused.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LINES, MANY, at } from '../../stories/composerWritingFixtures'

export default { title: 'Components/Input box/Writing/Words in it' } satisfies Meta
type Story = StoryObj

export const Empty = at()
export const AFewWords: Story = { ...at({ text: 'Make the export button bigger' }), name: 'A few words' }
/** past one line the words take the box's whole width and +, the microphone and send go to a row under them (the
 * phone as the desktop) */
export const ManyLines: Story = { ...at({ text: LINES }), name: 'Many lines' }
/** the words fade at the box's bottom while more of them is below */
export const LongerThanTheBoxItScrolls: Story = { ...at({ text: MANY }), name: 'Longer than the box: it scrolls' }
export const WritingInItFocused: Story = { ...at({}, { focus: ['textarea'], focusWithin: ['#composer', '[data-box]'] }), name: 'Writing in it (focused)' }
export const WritingInItWordsInIt: Story = { ...at({ text: 'Make the export' }, { focus: ['textarea'], focusWithin: ['#composer', '[data-box]'] }), name: 'Writing in it, words in it' }
