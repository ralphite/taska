// F479 (r982): searching by voice on the phone, walked through: say what to find, fix a misheard word, say more,
// open a result, come back, leave. What it is and every journey: searchProto.tsx.
import { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from './Frames'
import { GuideLine, Mark, sel, type Step } from './guide'
import { SearchPhone } from './searchProto'

export default { title: 'Prototype/F479 Search everything/Walk through', parameters: { layout: 'padded' } } satisfies Meta

const STEPS: Step[] = [
  { say: 'Tap search.', tap: sel('[aria-label="Search"]') },
  { say: 'Say “where the export loses my filter”, then ↑.', tap: sel('[aria-label="Stop and search"]') },
  { say: 'Tap the right word.', tap: sel('[data-side="alt"]') },
  { say: 'To add more, tap the mic.', tap: sel('[aria-label="Say more"]') },
  { say: 'Say “only on the phone”, then ↑.', tap: sel('[aria-label="Stop and search"]') },
  { say: 'Tap B018.', tap: sel('article[data-n="18"] [data-swipe]') },
  { say: 'Back.', tap: sel('[aria-label="Back"]') },
  { say: 'Leave search.', tap: sel('[aria-label="Leave search"]') },
]

function Walk() {
  const [k, setK] = useState(0)
  const [n, setN] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  return (
    <div className="bg-white p-4 dark:bg-zinc-900">
      <div className="flex w-[393px] flex-col gap-3">
        <Frame layout="phone">
          <div ref={root} className="relative h-full">
            <SearchPhone key={k} step={STEPS[n] ?? null} onNext={() => setN((x) => x + 1)} />
            <Mark root={root} step={STEPS[n] ?? null} />
          </div>
        </Frame>
        <GuideLine n={n} total={STEPS.length} say={STEPS[n]?.say} onAgain={() => (setK((x) => x + 1), setN(0))} />
      </div>
    </div>
  )
}

/** Tap your way through it: say, fix a word, say more, open a result, come back, leave (it never plays itself). */
export const SayThenSayMore: StoryObj = { name: 'Say, then say more', render: () => <Walk /> }
