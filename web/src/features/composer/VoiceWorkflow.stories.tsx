// A voice message from start to end, on one page (T722, D127): how its words are worked out (two models at once:
// fast words first, the strong model's words replace them), then each state of model/voiceStates (T726) as a row in four places: the New input
// and an item, each on the desktop and the phone. The normal ways first, the other outcomes and branches after. Every
// cell is drawn as the state's own story draws it (the box, the New input page's list, the line over the phone's box,
// the item's talk), with the same fixtures (stories/voiceWorkflowFixtures); where a state shows nothing, the cell says so.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { COLUMNS, Place, ROWS, SECTIONS } from '../../stories/voiceWorkflowFixtures'
import { VOICE_STATE_LIST, VOICE_STATES, sayIn } from '../../model/voiceStates'

export default { title: 'UI/Input box/Voice/Whole workflow' } satisfies Meta
type Story = StoryObj

const LABEL = 'w-44 shrink-0'

const Step = ({ head, children, tone = 'zinc' }: { head: string; children?: ReactNode; tone?: 'zinc' | 'amber' | 'emerald' | 'blue' }) => (
  <div
    className={`w-44 rounded-lg border px-3 py-2 font-sans ${
      { zinc: 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950', amber: 'border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10', emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-400/40 dark:bg-emerald-400/10', blue: 'border-blue-300 bg-blue-50 dark:border-blue-400/40 dark:bg-blue-400/10' }[tone]
    }`}
  >
    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{head}</div>
    {children ? <div className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-300">{children}</div> : null}
  </div>
)
const Arrow = () => <span className="shrink-0 font-sans text-lg text-zinc-400">→</span>

/** How a voice note's words are worked out, and where sending and the organizer come in. */
function Flow() {
  return (
    <section aria-label="How it works" className="flex items-center gap-3 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
      <Step head="Record">Stop, or send while recording</Step>
      <Arrow />
      <div className="flex flex-col gap-2">
        <Step head="Fast model" tone="amber">
          First words in about 2 s: “{sayIn('fastWords', 'chip')?.say}”
        </Step>
        <Step head="Strong model" tone="emerald">
          At the same time; up to 3 tries × 30 s
        </Step>
      </div>
      <Arrow />
      <Step head="Final words" tone="emerald">
        The strong words replace the fast ones; if it fails, the fast words stay
      </Step>
      <Arrow />
      <Step head="Send" tone="blue">
        Any time, also before the final words; they swap in after
      </Step>
      <Arrow />
      <Step head="Organizer">Waits for the final words, 150 s at most</Step>
      <Arrow />
      <Step head="What it became">Created B014, Added to F012, For an agent, Handled</Step>
    </section>
  )
}

/** Every state of a voice message, in four places: the normal ways first (words final before sending; sent before),
 * then the other outcomes, the branches of its words, of sending and organizing, and changes after sending. */
export const WholeWorkflow: Story = {
  name: 'Whole workflow',
  render: () => {
    let n = 0
    return (
      <div className="flex w-max flex-col gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
        <Flow />
        {/* the places, over the rows as the page scrolls */}
        <div className="sticky top-0 z-10 -my-3 flex gap-6 bg-zinc-200 px-4 py-3 font-sans text-base font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
          <span className={LABEL} />
          {COLUMNS.map((c, i) => (
            <h2 key={c.title} style={{ width: c.w }} className={`m-0 shrink-0 text-base ${i === 2 ? 'ml-6' : ''}`}>
              {c.title}
            </h2>
          ))}
        </div>
        {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((key, k) => (
          <section key={key} aria-label={SECTIONS[key].title} className="flex flex-col gap-3">
            <header className="font-sans">
              <h2 className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {k + 1}. {SECTIONS[key].title}
              </h2>
              <p className="m-0 mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{SECTIONS[key].where}</p>
            </header>
            {VOICE_STATE_LIST.flatMap((state) => ROWS[state].filter((r) => r.section === key).map((r) => ({ state, r }))).map(({ state, r }) => (
              <div key={`${state} ${r.label ?? ''}`} aria-label={r.label ?? VOICE_STATES[state].label} className="flex items-start gap-6 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
                <h3 className={`${LABEL} m-0 font-sans text-sm font-semibold text-zinc-700 dark:text-zinc-200`}>
                  <span className="mr-1.5 text-zinc-400 tabular-nums">{++n}</span>
                  {r.label ?? VOICE_STATES[state].label}
                  {r.note ? <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">{r.note}</span> : null}
                  <code className="mt-1 block text-[11px] font-normal text-zinc-400">{state}</code>
                </h3>
                {r.cells.map((c, i) => (
                  <div key={COLUMNS[i].title} className={i === 2 ? 'ml-6' : ''}>
                    <Place cell={c} col={COLUMNS[i]} />
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    )
  },
}
