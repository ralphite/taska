// The box empty, with a few words, many lines, longer than the box, focused.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LINES, MANY, at } from '../../stories/composerWritingFixtures'

export default { title: 'Components/Input box/Writing/Words in it' } satisfies Meta
type Story = StoryObj

export const Empty = at()
export const AFewWords: Story = { ...at({ text: 'Buy milk on the way home' }), name: 'A few words' }
export const ManyLines: Story = { ...at({ text: LINES }), name: 'Many lines' }
export const LongerThanTheBoxItScrolls: Story = { ...at({ text: MANY }), name: 'Longer than the box: it scrolls' }
export const WritingInItFocused: Story = { ...at({}, { focus: ['textarea'], focusWithin: ['#composer', '[data-box]'] }), name: 'Writing in it (focused)' }
export const WritingInItWordsInIt: Story = { ...at({ text: 'Buy milk' }, { focus: ['textarea'], focusWithin: ['#composer', '[data-box]'] }), name: 'Writing in it, words in it' }
