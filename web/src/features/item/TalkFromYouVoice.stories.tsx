// Your message with a voice note: as sent, its words still being worked out or coming in after, playing, and the
// rarer ones (length unknown, words not tidied).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, mine, r4, voice } from '../../stories/fromYouFixtures'

export default { title: 'Components/Conversation/Message/From you/Voice notes' } satisfies Meta
type Story = StoryObj

const LINK_AND_WORDS = 'http://127.0.0.1:7340/p/demo/D2\nSync it to its three subpages.'
export const WithAVoiceNote: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })] }), name: 'With a voice note' }
export const VoiceNoteBeingTranscribed: Story = { ...at([mine({ text: '' })], { inputs: [r4({ text: '', files: [voice], trWait: true })] }), name: 'Its voice note being written out' }
// B626: the voice note's words came in after it was sent; nothing was changed, so it is not marked edited
export const WordsAndAVoiceNoteItsWordsInLater: Story = {
  ...at([mine({ text: LINK_AND_WORDS })], { inputs: [r4({ text: LINK_AND_WORDS, files: [voice] })] }),
  name: 'Words and a voice note, its words in after sending: not edited',
}
export const VoiceNotePlaying: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: true, t: 4 }) } }), name: 'Its voice note playing' }
export const VoiceNoteStoppedPartway: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: false, t: 7 }) } }), name: 'Its voice note stopped partway' }
export const VoiceNoteLengthUnknown: Story = { ...at([mine()], { inputs: [r4({ files: [{ ...voice, name: 'voice.webm' }] })] }), name: 'Voice note, length unknown' }
export const VoiceNoteWordsNotTidied: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })], env: { tidy: false } }), name: 'Voice note, words not tidied' }
