// T457: the one input box (and the line above it that says what happened to what you sent), in every state: what it
// writes to, words, pictures, voice notes on their way, a recording, words still being worked out, sending, failing.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { Foot } from '../../components/Shell'
import { Composer } from '../../components/Composer'
import { R_STATE, U, bump, els, model, type DraftFile } from '../../lib/state'
import { Pane, type Setup } from '../lib/demo'

const meta: Meta = {
  title: 'Components/Input box',
  parameters: {
    covers: [
      'Composer',
      'BoxHomeSlot',
      'BoxInner',
      'TextArea',
      'BoxBtn',
      'ScopeLine',
      'ScopeLink',
      'ScopeX',
      'DraftFiles',
      'Doubts',
      'RecBar',
      'RecTime',
      'Feedback',
      'Link',
      'Dismiss',
      'Foot',
    ],
  },
}
export default meta
type Story = StoryObj

function Box({ text }: { text: string }) {
  useEffect(() => {
    const t = els.text
    if (t) {
      t.value = text
      t.dispatchEvent(new Event('input', { bubbles: true }))
    }
    bump('composer', 'feedback')
  }, [text])
  return (
    <Pane w="item" h="flex flex-col justify-end pt-40">
      <Foot hidden={false} wideCls="" />
      <Composer />
    </Pane>
  )
}
const box = (text = '', setup?: (x: Setup) => void): Story => ({
  parameters: { taska: { setup } },
  render: () => <Box text={text} />,
})
const done = Promise.resolve()
const shot = (i: number): DraftFile => {
  const f = model.S.inputs.flatMap((r) => r.files).filter((x) => x.mime?.startsWith('image/'))[i]
  return { ...f, mime: f.mime || 'image/png', done, size: 48213 }
}
const voice = (extra: Partial<DraftFile> = {}): DraftFile => {
  const f = model.S.inputs.flatMap((r) => r.files).find((x) => x.mime?.startsWith('audio/'))!
  return { ...f, mime: f.mime || 'audio/webm', done, ms: 23000, ...extra }
}
const SAID =
  '\u8ba2\u5355\u9875\u5217\u8868\u5f88\u957f\u7684\u65f6\u5019\u6eda\u52a8\u5f88\u5361\uff0c\u5927\u6982 2,000 \u5355\u4ee5\u4e0a\u5c31\u5f00\u59cb\u5361\u4e86\u3002'
const LONG =
  SAID +
  '\n\u6211\u5728 iPhone \u548c MacBook \u4e0a\u90fd\u8bd5\u4e86\uff0cSafari \u548c Chrome \u90fd\u4e00\u6837\u3002\n\u7b5b\u9009\u4e86\u201c\u5df2\u4ed8\u6b3e\u201d\u4e4b\u540e\u5c31\u4e0d\u5361\u4e86\uff0c\u6240\u4ee5\u5e94\u8be5\u662f\u884c\u6570\u592a\u591a\u3002\n\u80fd\u4e0d\u80fd\u5148\u53ea\u663e\u793a 200 \u884c\uff0c\u5f80\u4e0b\u6eda\u518d\u52a0\u8f7d\uff1f\u53e6\u5916\u6eda\u52a8\u7684\u65f6\u5019\u987a\u4fbf\u770b\u4e00\u4e0b\u662f\u4e0d\u662f\u56fe\u7247\u592a\u5927\u3002'

/** Empty, writing a new input to the project. */
export const Empty = box()
export const Words = box(SAID)
export const ManyLines = box(LONG)
/** Writing to an open item: the line in the box says where it goes. */
export const ToAnItem = box(SAID, ({ it }) => (U.open = it('F1').n))
export const WithPictures = box('\u89c1\u622a\u56fe', () => (U.files = [shot(0), shot(1)]))
export const PictureUploading = box('', () => (U.files = [{ ...shot(0), f: undefined, preview: undefined }]))
export const PictureFailed = box('', () => (U.files = [{ ...shot(0), failed: true }]))
/** A voice note whose words are still being worked out. */
export const VoiceTranscribing = box('', () => (U.files = [voice({ transcribing: true, tr: '' })]))
export const VoiceWithWords = box(SAID, () => (U.files = [voice({ tr: SAID })]))
/** The two transcriptions disagree: the spots are said under the voice note before you send. */
export const VoiceDoubts = box(SAID, () => {
  U.files = [
    voice({
      tr: SAID,
      doubts: [{ was: '2,000', alt: '20,000', why: 'heard both' }],
    }),
  ]
})
export const VoiceFailed = box('', () => (U.files = [voice({ tr: '', tr_error: 'The words could not be worked out' })]))
/** Recording: the time and the level of your voice. */
export const Recording = box('', () => {
  Object.assign(R_STATE, {
    rec: {} as MediaRecorder,
    t0: Date.now() - 14000,
    levels: Array.from({ length: 48 }, (_, i) => Math.abs(Math.sin(i / 3)) * 0.9),
  })
})
/** Editing an input you sent. */
export const EditingAnInput = box(SAID, ({ S }) => {
  const r = S.inputs.find((x) => !x.acked)!
  U.amend = { id: r.id, mode: 'edit', v: r.v || 0, base: r.text }
})
export const AddingToAnInput = box('', ({ S }) => {
  const r = S.inputs.find((x) => !x.acked)!
  U.amend = { id: r.id, mode: 'append', v: r.v || 0 }
})
/** Commenting on a document's paragraph. */
export const CommentOnAParagraph = box('', ({ S }) => {
  const d = S.docs[0]
  U.open = d.n
  U.doc = d.d
  U.docSel = new Set([d.blocks[1].key])
})
/** Sent: the line above the box says it is on its way, with Undo. */
export const Sending = box('', () => {
  U.outbox = [{ id: 'q1', q: 'q1', t: Date.now(), text: SAID, files: [], scope: null, p: '/p/shop/', sending: true }]
})
export const NotSent = box('', () => {
  U.outbox = [{ id: 'q1', q: 'q1', t: Date.now(), text: SAID, files: [], scope: null, p: '/p/shop/', failed: true }]
})
/** Taska out of reach: it goes by itself the moment Taska answers. */
export const WaitingForTaska = box('', () => {
  U.outbox = [
    { id: 'q1', q: 'q1', t: Date.now(), text: SAID, files: [], scope: null, p: '/p/shop/', failed: true, net: true },
  ]
})
/** Just sent and filed: what the agent did with it. */
export const Filed = box('', ({ S }) => {
  U.lastSent = S.inputs.find((r) => r.org?.msg?.startsWith('Created'))!.id
})
