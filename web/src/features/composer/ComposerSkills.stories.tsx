// I821: "/" at the start of the box lists the skills (shared documents named /name), each with what it is for; the
// letters typed narrow the list (in order, apart too, as in Codex: "/pt" finds /proto) and stand out in the names; ↑↓ choose, ↵ or ⇥ (or a click) puts the skill's name and a space in the box, and
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
  { name: '/proto', what: '先在 Storybook 做个能点的原型给你看，选好再做。' },
  { name: '/qa', what: '回答问题，只答不做。' },
  { name: '/why', what: '查清楚怎么回事，讲原因、提办法，不改。' },
]
const at = (text: string): Story => ({
  // the list is a card over the box, as Codex shows its commands: room above the box for it
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => <div className="pt-56">{boxAt({ text }, layout === 'desk', { skills: SKILLS })}</div>}</Frames>,
})

/** the first is chosen: ↵ takes it */
export const SlashTyped: Story = { ...at('/'), name: '"/" typed: the skills' }
export const LettersNarrowIt: Story = { ...at('/p'), name: '"/p": the skills it fits, its letters standing out' }
/** as in Codex: the letters in order, not only at the start */
export const LettersApart: Story = { ...at('/pt'), name: '"/pt": letters apart still find /proto' }
/** the list is gone; the words after it are the question */
export const Picked: Story = { ...at('/qa '), name: 'Picked: its name and a space' }
export const NoneFits: Story = { ...at('/x'), name: 'None fits: no list' }
export const NotAtTheStart: Story = { ...at('what does /qa do'), name: 'Not at the start: no list' }
