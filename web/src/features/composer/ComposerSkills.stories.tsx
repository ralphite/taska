// I821: "/" at the start of the box lists the skills (shared documents named /name), each with what it is for; the
// letters typed narrow the list; ↑↓ choose, ↵ or ⇥ (or a click) puts the skill's name and a space in the box, and
// what you write or say after it comes to the agents with the skill's text. Esc closes the list; a space, other words
// or none fitting show none.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { boxAt } from '../../stories/boxFixtures'
import type { Skill } from '../../model/skills'

export default { title: 'UI/Input box/Writing/Skills' } satisfies Meta
type Story = StoryObj

const SKILLS: Skill[] = [
  { name: '/plan', what: '先出方案再动手：目标、做法、要定的事。' },
  { name: '/qa', what: '回答问题，只答不做。' },
]
const at = (text: string): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => boxAt({ text }, layout === 'desk', { skills: SKILLS })}</Frames>,
})

/** the first is chosen: ↵ takes it */
export const SlashTyped: Story = { ...at('/'), name: '"/" typed: the skills' }
export const LettersNarrowIt: Story = { ...at('/q'), name: '"/q": the skills it fits' }
/** the list is gone; the words after it are the question */
export const Picked: Story = { ...at('/qa '), name: 'Picked: its name and a space' }
export const NoneFits: Story = { ...at('/x'), name: 'None fits: no list' }
export const NotAtTheStart: Story = { ...at('what does /qa do'), name: 'Not at the start: no list' }
