// B749 (D132): an agent's questions in a row, one card where the last of them is. A question a page, 1 · 2 · 3 above
// it (a tick once answered, a tap goes back to it); a pick turns to the next question still to answer; Send sends what
// is answered so far as one reply, a line a question ("- question → ✓ choice"), naming them, and the others keep
// waiting. All answered: the card greys, Edit answers again. The prototype was Prototype/Several questions (B749).

import { useEffect, useState } from 'react'
import { lastAgentMessage } from '../../model/items'
import { choiceLabels, choiceMulti } from '../../model/markdown'
import { NEED_STATES, needOf } from '../../model/needStates'
import type { OutShow } from '../../model/outgoingStates'
import { rowAnswer } from '../../model/talk'
import type { Item, Message } from '../../model/types'
import { Kbd } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import { DECIDED_ON, FIELD, MODIFY_LINK, NEED, PRIMARY_BASE, SECOND, chosenTone } from '../../ui/tones'
import { KeepBtn, NeedFrame, msgName, type CardEvents } from './NeedsCard'
import type { TalkEnv } from './talkEnv'

/** what a question asks: its first line */
const asked = (x: Message) => x.text.split('\n')[0].trim()

interface Mine {
  picked: ReadonlySet<number>
  words: string
}

/** your one reply to the questions sent: a line each, the question and what you chose or wrote */
const replyOf = (qs: readonly Message[], mine: readonly Mine[]) =>
  qs
    .map((x, i) => {
      const ls = choiceLabels(x.text).map((l) => l.trim())
      const said = ls.length ? [...mine[i].picked].sort((a, b) => a - b).map((k) => `✓ ${ls[k]}`).join(' ') : mine[i].words.trim().replace(/\s*\n\s*/g, ' ')
      return `- ${asked(x)} → ${said}`
    })
    .join('\n')

export function AskRowCard({ it, row, env, on, going = null }: {
  it: Item
  row: readonly Message[]
  env: TalkEnv
  on: CardEvents
  /** your answer to some of them on its way: which, and where it is */
  going?: { of: readonly number[]; card: OutShow } | null
}) {
  const answers = row.map((x) => rowAnswer(it.thread, row, x))
  const labels = row.map((x) => choiceLabels(x.text).map((l) => l.trim()))
  const has = (i: number) => !!answers[i] || !!going?.of.includes(row[i].id)
  const [editing, setEditing] = useState(false)
  // what you picked and wrote here, a question each; answered ones start as you answered them
  const start = (): Mine[] => row.map((_, i) => ({ picked: new Set(labels[i].flatMap((l, k) => (answers[i]?.picked.includes(l) ? [k] : []))), words: answers[i]?.words ?? '' }))
  const [mine, setMine] = useState<Mine[]>(start)
  const [page, setPage] = useState(() => Math.max(0, row.findIndex((_, i) => !has(i))))
  const at = Math.min(page, row.length - 1)
  const sent = (i: number) => has(i) && !editing
  const done = row.every((_, i) => sent(i))
  const filled = (i: number) => (labels[i].length ? mine[i].picked.size > 0 : mine[i].words.trim() !== '')
  const toSend = row.flatMap((_, i) => (!sent(i) && filled(i) ? [i] : []))
  const open = row.filter((_, i) => !sent(i)).length
  const x = row[at]
  const words = !labels[at].length
  const set = (i: number, m: Partial<Mine>) => setMine((all) => all.map((y, k) => (k === i ? { ...y, ...m } : y)))
  const go = (to: number) => setPage(Math.max(0, Math.min(row.length - 1, to)))
  const send = () => {
    if (!toSend.length) return
    const qs = toSend.map((i) => row[i])
    on.sendRow(it.n, qs.map((q) => q.id), replyOf(qs, toSend.map((i) => mine[i])) + (editing ? '\n\nChanged my answers' : ''))
    setEditing(false)
    const left = row.findIndex((_, i) => !has(i) && !toSend.includes(i))
    if (left >= 0) setPage(left)
  }
  const pick = (k: number, many: boolean) => {
    const next = new Set(many ? mine[at].picked : [])
    if (many && next.has(k)) next.delete(k)
    else next.add(k)
    set(at, { picked: next })
    // one choice: on to the next question still to answer (D132)
    if (!many) {
      const after = row.findIndex((_, i) => i > at && !sent(i) && !filled(i))
      if (after >= 0) setTimeout(() => setPage(after), 250)
    }
  }
  // the keys as on one question: a number picks, ← → turn the page, ⌘↵ sends
  useEffect(() => {
    if (!env.desk || done) return
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable
      const mineBox = t.dataset.askRow === String(it.n)
      if (typing && !(mineBox && e.key === 'Enter' && e.metaKey)) return
      if (e.key === 'ArrowRight' && !e.metaKey && !e.altKey) go(at + 1)
      else if (e.key === 'ArrowLeft' && !e.metaKey && !e.altKey) go(at - 1)
      else if (e.key === 'Enter' && e.metaKey) send()
      else if (!sent(at) && !e.metaKey && !e.ctrlKey && /^[1-9]$/.test(e.key) && Number(e.key) <= labels[at].length) pick(Number(e.key) - 1, choiceMulti(x.text, Number(e.key) - 1))
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    addEventListener('keydown', key, true)
    return () => removeEventListener('keydown', key, true)
  })
  const need = needOf(it)
  const keep = need.keep != null && (!done || (NEED_STATES[need.state].card === 'onQuestion' && lastAgentMessage(it)?.id === row.at(-1)?.id))
  const pages = (
    <div className="flex items-center gap-1" role="tablist" aria-label="Questions">
      {row.map((q, i) => (
        <button
          key={q.id}
          role="tab"
          aria-selected={i === at}
          aria-label={`Question ${i + 1}${has(i) ? ', answered' : ''}`}
          onClick={() => setPage(i)}
          className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${
            i === at
              ? sent(i)
                ? 'bg-zinc-600 text-white dark:bg-zinc-300 dark:text-zinc-900'
                : 'bg-amber-500 text-amber-950 dark:bg-amber-400'
              : has(i) || filled(i)
                ? 'bg-white text-zinc-600 ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700'
                : 'text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-700'
          }`}
        >
          {(has(i) || filled(i)) && i !== at ? <Icon n="check" c="size-3.5" sw="3" /> : i + 1}
        </button>
      ))}
    </div>
  )
  const here = sent(at)
  const shown = going?.of.includes(x.id) && !answers[at]
  const body = (
    <>
      {pages}
      <Rich
        text={x.text}
        world={env.world}
        cls={`[&>p]:text-[16px] [&>p]:font-medium ${here ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-900 dark:text-zinc-100'}`}
        choosing={here || words ? null : { picked: mine[at].picked, pick }}
        done={here && !words ? (shown ? [...mine[at].picked].map((k) => labels[at][k]) : (answers[at]?.picked ?? [])) : null}
        onRef={on.ref}
        onPicture={on.picture}
      />
      {words ? (
        here ? (
          <p className="rounded-xl border border-zinc-200 px-3 py-2.5 whitespace-pre-wrap text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">{(shown ? mine[at].words : answers[at]?.words) || '—'}</p>
        ) : (
          <textarea rows={3} data-ask-row={it.n} className={FIELD} placeholder="Your answer" value={mine[at].words} onChange={(e) => set(at, { words: e.target.value })} />
        )
      ) : null}
    </>
  )
  // beside Approve or Accept the phone has no room for ‹ ›: the pages above turn it (B749 QA)
  const turn = (to: number, icon: 'left' | 'right', label: string) => (
    <button onClick={() => go(to)} disabled={to < 0 || to >= row.length} aria-label={label} className={`${SECOND} w-11 px-0 disabled:opacity-40 ${keep ? 'max-lg:hidden' : ''}`}>
      <Icon n={icon} c="size-4.5" sw="2.25" />
    </button>
  )
  const n = toSend.length
  return (
    <NeedFrame
      icon="ask"
      title={<>{msgName(row[row.length - 1])} asks you</>}
      t={row.at(-1)?.t}
      quiet
      done={done}
      going={going?.card ?? null}
      now={env.now}
      act={
        done && !going ? (
          <button
            onClick={() => {
              setMine(start())
              setEditing(true)
            }}
            className={MODIFY_LINK}
          >
            Edit
          </button>
        ) : editing ? (
          <button onClick={() => setEditing(false)} className={MODIFY_LINK.replace(/lg:opacity-0\S*|lg:group-hover\S*/g, '')}>
            Cancel
          </button>
        ) : null
      }
      body={body}
      foot={
        <>
          {turn(at - 1, 'left', 'Previous question')}
          {turn(at + 1, 'right', 'Next question')}
          {keep ? <KeepBtn it={it} need={need} on={on} /> : null}
          {here ? (
            <button disabled aria-pressed className={`${DECIDED_ON(chosenTone('answer'))} flex-1 lg:flex-none`}>
              <Icon n="check" c="size-4" sw="2.25" />
              Sent
            </button>
          ) : (
            <button disabled={!n} onClick={send} className={`${PRIMARY_BASE} ${NEED.answer.btn} flex-1 whitespace-nowrap lg:flex-none`}>
              {n && n < open ? `Send ${n} of ${open}` : 'Send answers'}
              {env.desk ? <Kbd k="⌘↵" /> : null}
            </button>
          )}
        </>
      }
    />
  )
}
