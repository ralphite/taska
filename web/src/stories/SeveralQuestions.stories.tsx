// B749 / F750 prototype (D132): an agent's questions in a row, one card. One question a page, 1 · 2 · 3 on top (a tick
// once answered, a tap goes back to it); a pick turns to the next page by itself; Send answers sends what is answered
// so far as one reply (the rest keep waiting). Only the existing card's parts: NeedFrame, the choices, the buttons.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { NeedFrame } from '../features/item/NeedsCard'
import { blocks } from '../model/markdown'
import { Kbd } from '../ui/bits'
import { Icon } from '../ui/Icon'
import { Rich } from '../ui/Markdown'
import { DECIDED_ON, FIELD, MODIFY_LINK, NEED, PRIMARY_BASE, SECOND, chosenTone } from '../ui/tones'
import { Frames } from './Frames'
import { modelOf } from './fixtures'
import { talkEnv } from './itemFixtures'

export default { title: 'Prototype/Several questions (B749)' } satisfies Meta
type Story = StoryObj

const QS = [
  '选了答案后，自动翻到下一个问题吗？\n- ( ) 自动翻到下一个\n- ( ) 每页按 Next',
  '允许只答一部分就发吗？\n- ( ) 允许，没答的继续等 Yadong\n- ( ) 全部答完才能发',
  '原型里还想看到哪种情况？',
]
/** a question's choices, by their words (none: it is answered in words) */
const labels = (q: string) => blocks(q, true).flatMap((b) => (b.kind === 'choices' ? b.labels.map((l) => l.trim()) : []))
const multi = (q: string) => blocks(q, true).some((b) => b.kind === 'choices' && b.multi)
const asked = (q: string) => q.split('\n')[0]

interface Answer {
  picked: ReadonlySet<number>
  words: string
}
const answered = (q: string, a: Answer) => (labels(q).length ? a.picked.size > 0 : a.words.trim() !== '')
/** your one reply: a line for each question answered, the question and what you chose or wrote */
const replyOf = (as: Answer[]) =>
  QS.flatMap((q, i) => {
    const a = as[i]
    if (!answered(q, a)) return []
    const said = labels(q).length ? [...a.picked].map((k) => `✓ ${labels(q)[k]}`).join('  ') : a.words.trim()
    return [`- ${asked(q)} → ${said}`]
  }).join('\n')

function Card({ desk, start }: { desk: boolean; start: { page?: number; answers?: { picked?: number[]; words?: string }[]; sent?: number[] } }) {
  const env = talkEnv(modelOf([]), desk)
  const [page, setPage] = useState(start.page ?? 0)
  const [as, setAs] = useState<Answer[]>(QS.map((_, i) => ({ picked: new Set(start.answers?.[i]?.picked ?? []), words: start.answers?.[i]?.words ?? '' })))
  // the questions already sent; the card is done once every one is (D132: the rest keep waiting)
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set(start.sent))
  const sent = gone.size === QS.length
  const q = QS[page]
  const here = gone.has(page)
  const done = QS.map((x, i) => answered(x, as[i]))
  const count = done.filter((d, i) => d && !gone.has(i)).length
  const set = (i: number, a: Partial<Answer>) => setAs((all) => all.map((x, k) => (k === i ? { ...x, ...a } : x)))
  const go = (to: number) => setPage(Math.max(0, Math.min(QS.length - 1, to)))
  const send = () => {
    if (!count) return
    const all = new Set([...gone, ...QS.flatMap((_, i) => (done[i] ? [i] : []))])
    setGone(all)
    const left = QS.findIndex((_, i) => !all.has(i))
    if (left >= 0) setPage(left)
  }
  const pick = (k: number, many: boolean) => {
    const next = new Set(many ? as[page].picked : [])
    if (many && next.has(k)) next.delete(k)
    else next.add(k)
    set(page, { picked: next })
    // one choice: on to the next question still to answer (D132: picked, it turns the page)
    if (!many) {
      const after = QS.findIndex((x, i) => i > page && !answered(x, as[i]) && !gone.has(i))
      if (after >= 0) setTimeout(() => setPage(after), 250)
    }
  }
  // the keys as now: a number picks, ← → turn the page, ⌘↵ sends
  useEffect(() => {
    if (!desk || sent) return
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' && !(e.key === 'Enter' && e.metaKey)) return
      if (e.key === 'ArrowRight') go(page + 1)
      else if (e.key === 'ArrowLeft') go(page - 1)
      else if (e.key === 'Enter' && e.metaKey) send()
      else if (!here && /^[1-9]$/.test(e.key) && Number(e.key) <= labels(q).length) pick(Number(e.key) - 1, multi(q))
      else return
      e.preventDefault()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })
  const pages = (
    <div className="flex items-center gap-1" role="tablist" aria-label="Questions">
      {QS.map((_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === page}
          onClick={() => setPage(i)}
          className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${
            i === page
              ? here
                ? 'bg-zinc-600 text-white dark:bg-zinc-300 dark:text-zinc-900'
                : 'bg-amber-500 text-amber-950 dark:bg-amber-400'
              : done[i]
                ? 'bg-white text-zinc-600 ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700'
                : 'text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-700'
          }`}
        >
          {done[i] && i !== page ? <Icon n="check" c="size-3.5" sw="3" /> : i + 1}
        </button>
      ))}
    </div>
  )
  const words = labels(q).length === 0
  const body = (
    <>
      {pages}
      <Rich
        text={q}
        world={env.world}
        cls={`[&>p]:text-[16px] [&>p]:font-medium ${here ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-900 dark:text-zinc-100'}`}
        choosing={here || words ? null : { picked: as[page].picked, pick }}
        done={here && !words ? [...as[page].picked].map((k) => labels(q)[k]) : null}
      />
      {words ? (
        here ? (
          <p className="rounded-xl border border-zinc-200 px-3 py-2.5 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">{as[page].words || '—'}</p>
        ) : (
          <textarea rows={3} className={FIELD} placeholder="Your answer" value={as[page].words} onChange={(e) => set(page, { words: e.target.value })} />
        )
      ) : null}
    </>
  )
  const turn = (to: number, icon: 'left' | 'right', label: string) => (
    <button onClick={() => go(to)} disabled={to < 0 || to >= QS.length} aria-label={label} className={`${SECOND} w-11 px-0 disabled:opacity-40`}>
      <Icon n={icon} c="size-4.5" sw="2.25" />
    </button>
  )
  return (
    <div className="space-y-3">
      <NeedFrame
        icon="ask"
        title={<>Claude Code · Shop project work asks you</>}
        quiet
        done={sent}
        now={env.now}
        act={
          sent ? (
            <button onClick={() => setGone(new Set())} className={MODIFY_LINK}>
              Edit
            </button>
          ) : null
        }
        body={body}
        foot={
          <>
            {turn(page - 1, 'left', 'Previous question')}
            {turn(page + 1, 'right', 'Next question')}
            {here ? (
              <button disabled aria-pressed className={`${DECIDED_ON(chosenTone('answer'))} flex-1 lg:flex-none`}>
                <Icon n="check" c="size-4" sw="2.25" />
                Sent
              </button>
            ) : (
              <button disabled={!count} onClick={send} className={`${PRIMARY_BASE} ${NEED.answer.btn} flex-1 whitespace-nowrap lg:flex-none`}>
                {count && count < QS.length ? `Send ${count} of ${QS.length}` : 'Send answers'}
                {desk ? <Kbd k="⌘↵" /> : null}
              </button>
            )}
          </>
        }
      />
      {gone.size ? (
        // prototype only: the reply it sends, one line a question
        <div className="rounded-xl bg-white p-3 text-sm dark:bg-zinc-900">
          <p className="pb-1 text-xs font-semibold text-zinc-500">Your reply</p>
          <Rich text={replyOf(as.map((a, i) => (gone.has(i) ? a : { picked: new Set<number>(), words: '' })))} world={env.world} />
        </div>
      ) : null}
    </div>
  )
}

const at = (start: Parameters<typeof Card>[0]['start'] = {}): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => (
        <div className="p-3">
          <Card desk={layout === 'desk'} start={start} />
        </div>
      )}
    </Frames>
  ),
})

export const ThreeQuestionsTheFirstOpen: Story = { ...at(), name: 'Three questions, the first open' }
export const OneAnsweredOnTheSecond: Story = { ...at({ page: 1, answers: [{ picked: [0] }] }), name: 'One answered, on the second' }
export const OnTheQuestionInWords: Story = { ...at({ page: 2, answers: [{ picked: [0] }, { picked: [0] }] }), name: 'On the question in words' }
export const TwoSentTheOneInWordsWaits: Story = { ...at({ page: 2, answers: [{ picked: [0] }, { picked: [0] }], sent: [0, 1] }), name: 'Two sent, the one in words still waits' }
export const AllSent: Story = { ...at({ answers: [{ picked: [0] }, { picked: [0] }, { words: '只答一部分就发的样子' }], sent: [0, 1, 2] }), name: 'All sent' }
