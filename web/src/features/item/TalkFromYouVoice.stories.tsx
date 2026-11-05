// Your message with a voice note: its pill inside your bubble (T668), under your words; nothing heard, the bubble is
// the pill. As sent, its words still being worked out or coming in after, playing, on its way, and the rarer ones.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, mine, out, r4, shot, voice } from '../../stories/fromYouFixtures'
import { message } from '../../stories/fixtures'

export default { title: 'Components/Conversation/Message/From you/Voice notes' } satisfies Meta
type Story = StoryObj

const LINK_AND_WORDS = 'http://127.0.0.1:7340/p/demo/D2\nSync it to its three subpages.'
const LONG =
  'http://127.0.0.1:7340/p/demo/D2 Sync it to its three subpages. Keep every filter and sort when the page is opened again, and say which ones were kept at the top of the export, so whoever reads it knows what they are looking at.'
const note = (len: string) => ({ f: `f2-voice_${len}.webm`, name: `voice_${len}.webm`, mime: 'audio/webm' })
export const WithAVoiceNote: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })] }), name: 'With a voice note' }
export const NothingHeard: Story = { ...at([mine({ text: '' })], { inputs: [r4({ text: '', files: [note('0-03')] })] }), name: 'Nothing heard: the bubble is the voice note' }
export const VoiceNoteBeingTranscribed: Story = { ...at([mine({ text: '' })], { inputs: [r4({ text: '', files: [voice], trWait: true })] }), name: 'Its voice note being written out' }
// B626: the voice note's words came in after it was sent; nothing was changed, so it is not marked edited
export const WordsAndAVoiceNoteItsWordsInLater: Story = {
  ...at([mine({ text: LINK_AND_WORDS })], { inputs: [r4({ text: LINK_AND_WORDS, files: [voice] })] }),
  name: 'Words and a voice note, its words in after sending: not edited',
}
export const VoiceNotePlaying: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: true, t: 4000 }) } }), name: 'Its voice note playing' }
export const VoiceNoteStoppedPartway: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: false, t: 7000 }) } }), name: 'Its voice note stopped partway' }
/** on its way: the pill in the faded bubble, not yet to play (the talk draws it under the message before it) */
export const VoiceNoteOnItsWay: Story = {
  ...at([message({ id: 1, by: 'claude-code', kind: 'say', text: 'Which filter should the export keep?' })], { t: { outgoing: [{ ...out('Sending…').t.outgoing[0], text: 'The export should keep the filter I set.', voices: [voice] }] } }),
  name: 'Its voice note on its way',
}
export const ALongVoiceNote: Story = { ...at([mine({ text: LONG })], { inputs: [r4({ text: LONG, files: [note('4-37')] })] }), name: 'A long voice note' }
export const TwoVoiceNotes: Story = {
  ...at([mine({ text: 'The first note is the export bug, the second how to make it happen again.' })], { inputs: [r4({ text: 'The first note is the export bug, the second how to make it happen again.', files: [voice, note('0-41')] })] }),
  name: 'Two voice notes',
}
export const VoiceAndAPicture: Story = { ...at([mine()], { inputs: [r4({ files: [voice, shot] })] }), name: 'A voice note and a picture' }
export const VoiceNoteLengthUnknown: Story = { ...at([mine()], { inputs: [r4({ files: [{ ...voice, name: 'voice.webm' }] })] }), name: 'Voice note, length unknown' }
