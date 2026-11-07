// Your message with a voice note: its pill inside your bubble (T668), under your words; nothing heard, the bubble is
// the pill. As sent, its words still being worked out or coming in after, playing, on its way, and the rarer ones.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, mine, out, r4, shot, voice } from '../../stories/fromYouFixtures'
import { message } from '../../stories/fixtures'
import { record, waiting } from '../../stories/fixtures'

export default { title: 'UI/Item pane/Talk/Message/From you/Voice notes' } satisfies Meta
type Story = StoryObj

const LINK_AND_WORDS = 'http://127.0.0.1:7340/p/demo/D2\nSync it to its three subpages.'
const LONG_SAID =
  'Sync it to its three subpages. Keep every filter and sort when the page is opened again, and say which ones were kept at the top of the export, so whoever reads it knows what they are looking at.'
const LONG = `http://127.0.0.1:7340/p/demo/D2 ${LONG_SAID}`
const LONG_HEARD =
  'OK so this document, D2, sync it to its, its three subpages. And, um, keep every filter and the sort when the page is opened again, like when I come back to it later. And at the top of the export say which ones were kept, so whoever reads it, you know, knows what they are looking at.'
/** a voice note of this length; its words when it has them (none: still being written out, or nothing heard) */
const note = (len: string, tr?: string, heard?: string) => {
  const f = `f2-voice_${len}.webm`
  return { f, name: `voice_${len}.webm`, mime: 'audio/webm', voice: tr === undefined ? waiting(f) : record(f, tr, heard ?? tr) }
}
const BUG = 'Exporting with a filter set still writes every order, not only the ones the list shows.'
const STEPS = 'To make it happen: filter by Paid, open an order, go back to the list, then press Export.'
export const WithAVoiceNote: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })] }), name: 'With a voice note' }
export const NothingHeard: Story = { ...at([mine({ text: '' })], { inputs: [r4({ text: '', files: [note('0-03', '')] })] }), name: 'Nothing heard: the bubble is the voice note' }
export const VoiceNoteBeingTranscribed: Story = { ...at([mine({ text: '' })], { inputs: [r4({ text: '', files: [note('0-12')] })] }), name: 'Its voice note being written out' }
// B626: the voice note's words came in after it was sent; nothing was changed, so it is not marked edited
export const WordsAndAVoiceNoteItsWordsInLater: Story = {
  ...at([mine({ text: LINK_AND_WORDS })], { inputs: [r4({ text: LINK_AND_WORDS, files: [{ ...voice, voice: record(voice.f, 'Sync it to its three subpages.', 'Sync it to its, um, three subpages.') }] })] }),
  name: 'Words and a voice note, its words in after sending: not edited',
}
export const VoiceNotePlaying: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: true, t: 4000 }) } }), name: 'Its voice note playing' }
export const VoiceNoteStoppedPartway: Story = { ...at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: false, t: 7000 }) } }), name: 'Its voice note stopped partway' }
/** on its way: the pill in the faded bubble, not yet to play (the talk draws it under the message before it) */
export const VoiceNoteOnItsWay: Story = {
  ...at([message({ id: 1, by: 'claude-code', kind: 'say', text: 'Which filter should the export keep?' })], { t: { outgoing: [{ ...out('Sending…').t.outgoing[0], text: 'The export should keep the filter I set.', voices: [voice] }] } }),
  name: 'Its voice note on its way',
}
export const ALongVoiceNote: Story = { ...at([mine({ text: LONG })], { inputs: [r4({ text: LONG, files: [note('4-37', LONG_SAID, LONG_HEARD)] })] }), name: 'A long voice note' }
export const TwoVoiceNotes: Story = {
  ...at([mine({ text: `${BUG}\n${STEPS}` })], { inputs: [r4({ text: `${BUG}\n${STEPS}`, files: [note('0-12', BUG), note('0-41', STEPS, 'So to make it happen, filter by Paid, then open an order, any order, go back to the list and press Export.')] })] }),
  name: 'Two voice notes',
}
export const VoiceAndAPicture: Story = { ...at([mine()], { inputs: [r4({ files: [voice, shot] })] }), name: 'A voice note and a picture' }
export const VoiceNoteLengthUnknown: Story = { ...at([mine()], { inputs: [r4({ files: [{ ...voice, name: 'voice.webm' }] })] }), name: 'Voice note, length unknown' }
