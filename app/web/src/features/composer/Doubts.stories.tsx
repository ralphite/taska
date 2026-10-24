import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { openDoubts, pickSide, spotsIn, voiceStretches } from '../../model/doubts'
import { Frames } from '../../stories/Frames'
import { HEARD, HEARD_TEXT } from '../../stories/doubtFixtures'
import { Doubts, DraftWords, type Fixing } from './Doubts'

const meta: Meta = { title: 'Components/Composer/Misheard words' }
export default meta
type Story = StoryObj

const quiet = { use: () => {}, show: () => {} }

/** Under the box: each one with the other model's words (desktop), how many on the New input page and the phone. */
export const UnderTheBox: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {() => (
        <div className="flex flex-col gap-4">
          <Doubts view={{ kind: 'list', lines: openDoubts(HEARD_TEXT, HEARD) }} on={quiet} />
          <Doubts view={{ kind: 'card', toCheck: 1 }} on={quiet} />
          <Doubts view={{ kind: 'phone', toCheck: 1, showing: false }} on={quiet} />
          <Doubts view={{ kind: 'phone', toCheck: 0, showing: true }} on={quiet} />
        </div>
      )}
    </Frames>
  ),
}

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

/** The words with the two versions to pick from (click, or left/right in them); the unsure word underlined. */
export const Versions: Story = { render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} />}</Frames> }

/** The New input page's card: a voice note's own words can be selected to correct them. */
export const Correcting: Story = { render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix />}</Frames> }
