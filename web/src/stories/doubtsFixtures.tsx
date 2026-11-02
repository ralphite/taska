// The helpers Doubts's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { pickSide, spotsIn, voiceStretches, type HeardFile } from '../model/doubts'
import { Frames } from './Frames'
import { HEARD, HEARD_TEXT } from './doubtFixtures'
import { DraftWords, type Fixing } from '../features/composer/Doubts'
import { VOICE, boxAt } from './boxFixtures'

type Story = StoryObj

export const quiet = { use: () => {}, show: () => {} }

// the box with a voice note in it, as the page works it out on a list (a new input)
export const voice = (f: Partial<typeof VOICE>, text = '', pseudo?: Record<string, string[]>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={640}>{(layout) => boxAt({ text, files: [{ ...VOICE, ...f }] }, layout === 'desk')}</Frames>,
  ...(pseudo ? { parameters: { pseudo } } : {}),
})
export const recording = (pseudo?: Record<string, string[]>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={640}>{(layout) => boxAt({ rec: true }, layout === 'desk')}</Frames>,
  ...(pseudo ? { parameters: { pseudo } } : {}),
})

export function Picking({ fix }: { fix: boolean }) {
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

export const AGAIN = 'Move the filter to the side bar, and the side bar stays.'
export const AGAIN_HEARD: HeardFile[] = [{ key: 'v1', trAdded: AGAIN, doubts: [{ was: 'side bar', alt: 'sidebar', why: 'two models', show: ['side bar', 'sidebar'], also: [{ was: 'side bar', alt: 'sidebar' }] }] }]
