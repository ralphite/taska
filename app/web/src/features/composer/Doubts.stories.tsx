import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { openDoubts, pickSide, spotsIn, voiceStretches } from '../../model/doubts'
import { Frames } from '../../stories/Frames'
import { HEARD, HEARD_TEXT } from '../../stories/doubtFixtures'
import { Doubts, DraftWords, type Fixing } from './Doubts'
import { VOICE, boxAt } from '../../stories/boxFixtures'

const meta: Meta = { title: 'Components/Input box/Voice' }
export default meta
type Story = StoryObj

const quiet = { use: () => {}, show: () => {} }

// the box with a voice note in it, as the page works it out on a list (a new input)
const voice = (f: Partial<typeof VOICE>, text = '', pseudo?: Record<string, string[]>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={640}>{(layout) => boxAt({ text, files: [{ ...VOICE, ...f }] }, layout === 'desk')}</Frames>,
  ...(pseudo ? { parameters: { pseudo } } : {}),
})
const recording = (pseudo?: Record<string, string[]>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={640}>{(layout) => boxAt({ rec: true }, layout === 'desk')}</Frames>,
  ...(pseudo ? { parameters: { pseudo } } : {}),
})

export const Recording = recording()
export const RecordingPointingAtTheCheck: Story = { ...recording({ hover: ['[aria-label="Stop and put words in the box"]'] }), name: 'Recording, pointing at the check' }
export const Transcribing = voice({ tr: '', transcribing: true })
export const TranscribingTryingAgain: Story = { ...voice({ tr: '', transcribing: true, retrying: true }), name: 'Transcribing, trying again' }
export const TranscribedItsWordsInTheBox: Story = { ...voice({ tr: 'Keep the sort too.' }, 'Keep the sort too.'), name: 'Transcribed, its words in the box' }
export const MaybeMisheard: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {(layout) => boxAt({ text: HEARD_TEXT, files: HEARD.map((h) => ({ ...VOICE, ...h, tr: HEARD_TEXT })), doubts: <Doubts view={layout === 'desk' ? { kind: 'list', lines: openDoubts(HEARD_TEXT, HEARD) } : { kind: 'phone', toCheck: 1, showing: false }} on={quiet} /> }, layout === 'desk')}
    </Frames>
  ),
}
export const MaybeMisheardOnTheNewInputPage: Story = {
  name: 'Maybe misheard, on the New input page',
  render: () => <Frames phone={false} deskWidth={640}>{() => <Doubts view={{ kind: 'card', toCheck: 1 }} on={quiet} />}</Frames>,
}
export const MayBeCutShort = voice({ tr: 'Keep the sort', more: true }, 'Keep the sort')
export const NoWordsHeard = voice({ tr: '' })
export const NoTranscript = voice({ tr: '', trError: 'Gemini HTTP 503' })

function Picking({ fix }: { fix: boolean }) {
  const [text, setText] = useState(HEARD_TEXT)
  const [files, setFiles] = useState(HEARD)
  const [fixing, setFixing] = useState<Fixing | null>(null)
  return (
    <DraftWords
      text={text}
      spots={spotsIn(text, files)}
      stretches={voiceStretches(text, files)}
      fixing={fixing}
      className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-[15px] leading-8 whitespace-pre-wrap dark:border-blue-400/40 dark:bg-blue-400/5"
      on={{
        pick: (fk, k, side) => {
          const r = pickSide(text, files[0], k, side)
          setText(r.text)
          setFiles([{ ...files[0], key: fk, trAdded: r.trAdded, doubts: r.doubts }])
        },
        escape: () => {},
        ...(fix ? { select: (s: number, e: number) => setFixing({ s, e, wrong: text.slice(s, e) }), fixSave: () => setFixing(null), fixStop: () => setFixing(null) } : {}),
      }}
    />
  )
}

/** The words with the two versions to pick from (click, or left/right in them): pick the other version. */
export const MaybeMisheardTheOtherVersionPicked: Story = { name: 'Maybe misheard, the other version picked', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} />}</Frames> }

/** A word one model was unsure of: underlined in the words. */
export const AWordOneModelWasUnsureOf: Story = { render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} />}</Frames> }

/** The New input page's card: a voice note's own words selected to correct them. */
export const CorrectingItsWords: Story = { render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix />}</Frames> }
