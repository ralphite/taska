// F479 (r982): searching by voice on the phone, walked through: say what to find, fix a misheard word, say more,
// open a result, come back, leave. What it is and every journey: searchProto.tsx.
import { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from './Frames'
import { GuideLine, Mark, sel, type Step } from './guide'
import { SearchPhone } from './searchProto'

export default { title: 'Prototype/F479 Search everything/Walk through', parameters: { layout: 'padded' } } satisfies Meta

const STEPS: Step[] = [
  { say: 'The list, as it is now. Tap the magnifier: the search page opens and the box at the bottom records at once.', tap: sel('[aria-label="Search"]') },
  { say: 'Say what to find (here: “where the export loses my filter”). Nothing is written while you speak. Tap ↑ to stop and search.', tap: sel('[aria-label="Stop and search"]') },
  { say: 'Taska writes out your words into the box, then searches every project: by the words at once, by what they mean a moment later. One word may be misheard: tap “export”.', tap: sel('[data-side="alt"]') },
  { say: 'It searched again with the right word. To say more, tap the mic in the box.', tap: sel('[aria-label="Say more"]') },
  { say: 'Your words and the results stay while you speak. Say what to add (here: “only on the phone”), then tap ↑.', tap: sel('[aria-label="Stop and search"]') },
  { say: 'What you added is lit at the end of your words; it searched all of them, and the results changed in place: B018 is first now. Tap it.', tap: sel('article[data-n="18"] [data-swipe]') },
  { say: 'B018 opens as it does anywhere, and the box replies to it. Tap ← to go back.', tap: sel('[aria-label="Back"]') },
  { say: 'The search, as you left it. Tap ← at the top to leave it: back to the list.', tap: sel('[aria-label="Leave search"]') },
]

/** The journeys, beside the phone (never over it). */
const Journeys = () => (
  <div className="flex max-w-md flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">How searching by voice goes</h2>
    <p>While you search, the box at the bottom (the one you always speak into) is the search box: what you said is its words, what it found is the page above. Saying more is what the box always does.</p>
    <ol className="flex list-decimal flex-col gap-2 pl-5">
      <li><b>Say it.</b> The magnifier opens search and records at once. ↑ stops; your words come in the box once Taska has written them out; it searches every project, by the words, then by what they mean. The closest come first, each with why.</li>
      <li><b>Say more.</b> With the results there, tap the mic. Your words and the results stay while you speak; ↑ adds what you said to the end of your words (lit) and searches all of them again. The results change in place.</li>
      <li><b>Fix what it heard.</b> A word heard two ways shows both in the box: tap the right one. Or tap the words and type; ↑ searches.</li>
      <li><b>Start over.</b> The x beside the words clears them and the results.</li>
      <li><b>Use a result.</b> Tap it: it opens as it does anywhere, and the box writes to it. Back: the same search.</li>
      <li><b>Leave.</b> ← at the top: back where you were. The next search starts afresh.</li>
    </ol>
    <p className="text-zinc-500 dark:text-zinc-400">Every state is drawn on its own in the three folders beside this one.</p>
  </div>
)

function Walk() {
  const [k, setK] = useState(0)
  const [n, setN] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  return (
    <div className="flex flex-wrap items-start gap-10 bg-white p-4 dark:bg-zinc-900">
      <div className="flex w-[393px] flex-col gap-3">
        <Frame layout="phone" label="phone · the yellow spot is the next tap">
          <div ref={root} className="relative h-full">
            <SearchPhone key={k} step={STEPS[n] ?? null} onNext={() => setN((x) => x + 1)} />
            <Mark root={root} step={STEPS[n] ?? null} />
          </div>
        </Frame>
        <GuideLine n={n} total={STEPS.length} say={STEPS[n]?.say} onAgain={() => (setK((x) => x + 1), setN(0))} />
      </div>
      <Journeys />
    </div>
  )
}

/** Tap your way through it: say, fix a word, say more, open a result, come back, leave (it never plays itself). */
export const SayThenSayMore: StoryObj = { name: 'Say, then say more', render: () => <Walk /> }
