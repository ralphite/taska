// T668, a prototype: option 3, a white play disc and its time right on the blue, dots for how far it got; nothing
// heard, the bubble is a round capsule. Gemini's design, drawn by the page's own talk.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { OPTIONS, one, walk } from './t668Voice'

export default { title: 'Prototype/T668 Voice in your bubble/Option 3' } satisfies Meta
type Story = StoryObj
const O = OPTIONS[3]

export const WalkThrough: Story = { ...walk(O), name: 'Walk through' }
export const WordsHeard: Story = one(O, { name: 'Words heard' })
export const NothingHeard: Story = one(O, { name: 'Nothing heard' })
export const Playing: Story = one(O, { name: 'Playing' })
export const PausedPartway: Story = one(O, { name: 'Paused partway' })
export const ItsWordsBeingWrittenOut: Story = one(O, { name: 'Its words being written out' })
export const Sending: Story = one(O, { name: 'Sending' })
export const ALongVoiceNote: Story = one(O, { name: 'A long voice note' })
export const TwoVoiceNotes: Story = one(O, { name: 'Two voice notes' })
export const VoiceAndAPicture: Story = one(O, { name: 'Voice and a picture' })
export const CommentByVoiceNothingHeard: Story = one(O, { name: 'Comment by voice, nothing heard' })
export const CommentByVoiceWithWords: Story = one(O, { name: 'Comment by voice, with words' })
export const PointerOnIt: Story = one(O, { name: 'Pointer on it' })
