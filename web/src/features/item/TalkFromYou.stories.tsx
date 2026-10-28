// A message of yours in an item's talk, one story for each state: the page's own talk (ItemTalk) with that item's data and the inputs your words came from.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Input, Item, Message } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, input, item, message } from '../../stories/fixtures'
import { talkOf, type PageOpts } from '../../stories/itemPage'

export default { title: 'Components/Conversation/Message/From you' } satisfies Meta
type Story = StoryObj

const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
const voice = { f: 'f2-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }
const shot = { f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }
const r4 = (f: Partial<Input> = {}) => input({ id: 'r4', text: 'The export should keep the filter I set.', ...f })
const mine = (f: Partial<Message> = {}) => message({ id: 1, by: 'you', kind: 'say', text: 'The export should keep the filter I set.', src: 'r4', ...f })
const at = (thread: Message[], o: PageOpts = {}, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', { inputs: [r4()], ...o })}</Frames>,
})
const LONG = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of what I said, with some words to fill it.`).join('\n')
const out = (state: string, bad = false, canUndo = false) => ({ t: { outgoing: [{ q: 'q1', text: 'Also keep the sort.', state, bad, canUndo }] } })

export const YourWords = at([mine()])
export const WithAVoiceNote = at([mine()], { inputs: [r4({ files: [voice] })] })
export const WithPictures = at([mine()], { inputs: [r4({ files: [shot, { ...shot, f: 'f4-shot.png' }] })] })
export const LongCutOnTheDesktop: Story = { ...at([mine({ text: LONG }), { ...message({ id: 2 }), t: later(3) }]), name: 'Long: cut on the desktop' }
export const SendingWithUndo: Story = { ...at([mine()], out('Sending…', false, true)), name: 'Sending, with Undo' }
export const UploadingAPicture = at([mine()], out('Uploading…'))
export const WaitingForTaska = at([mine()], out('Waiting for Taska…', true))
export const NotSentRetryEdit: Story = { ...at([mine()], out('Not sent', true)), name: 'Not sent: Retry, Edit' }
export const JustSentUndo: Story = { ...at([mine()], { t: { undo: (rid) => (rid === 'r4' ? 'q1' : null) } }), name: 'Just sent: Undo' }
export const ReadByTheAgent = at([mine()], {}, { readBy: { 'claude-code': Date.parse(T) + 30_000 } })
export const Edited = at([mine({ edited: later(1) })])
export const EditedTheEarlierVersionAbove: Story = {
  ...at([mine({ text: 'The export should keep the filter.' }), mine({ id: 2, text: 'r4 updated:\nThe export should keep the filter and the sort.', t: later(2) })]),
  name: 'Edited: the earlier version above',
}
export const VoiceNotePlaying = at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: true, t: 4 }) } })
export const VoiceNoteStoppedPartway = at([mine()], { inputs: [r4({ files: [voice] })], env: { play: () => ({ playing: false, t: 7 }) } })
export const VoiceNoteBeingTranscribed = at([mine({ text: '' })], { inputs: [r4({ text: '', files: [voice], trWait: true })] })
export const ItsInputMovedToAnotherProject = at([mine()], { inputs: [r4({ files: [voice], moved: { to: 'home', as: 'r40' } })] })
export const MovedPointerOnItsVoiceNote: Story = {
  ...at([mine()], { inputs: [r4({ files: [voice], moved: { to: 'home', as: 'r40' } })] }),
  name: 'Moved, pointer on its voice note',
  parameters: { pseudo: { hover: ['[data-voice], .group'] } },
}
