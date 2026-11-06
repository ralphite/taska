// I693 prototype: the parts the rules document needs that Taska does not have yet, drawn as Gemini designed them
// (prototype/i693-gemini-mock.html): the bar's name and version, its buttons, the proposal card, the text with a
// version's changes marked, the list of versions, the "why" line, the restore's question. Everything else is the
// page's own (PaneFrame, Sheet, DocView, DocEdit, Rich, Avatar, Toast, the tones). Prototype only.

import type { MouseEvent, ReactNode } from 'react'
import type { InlineWorld } from '../../ui/markdown/inline'
import { Avatar } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import { Rich } from '../../ui/Markdown'
import { DocBlock } from '../../features/docs/DocBlock'
import { CHOSEN_TONE, DECIDED_OFF, DECIDED_ON, DISABLED, MUTED, NEEDS_CARD, PRIMARY_BASE, SECOND } from '../../ui/tones'
import { when } from '../../model/time'
import { whoName } from '../../model/words'
import { at, counts, diff, type Chunk, type Proposal, type Version } from './rulesData'

/** the document's column, as DocView's */
export const COLUMN = 'lg:mx-auto lg:w-full lg:max-w-[min(46rem,calc(100%-5rem))]'
/** Approve, in Taska's Approve blue */
const APPROVE = `${PRIMARY_BASE} bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`
const name = (by: string) => (by === 'you' ? 'You' : whoName(by))

/** The bar's name: Rules, and the version shown (who, when). */
export function RulesHead({ v, label }: { v: Version; label?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 overflow-hidden text-sm">
      <Icon n="book" c="size-[18px] shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="shrink-0 font-semibold">Rules</span>
      <span className={`truncate ${MUTED}`}>{label ?? `v${v.v} · ${name(v.by)} · ${when(at(v.ago), Date.parse(at(0)))}`}</span>
    </span>
  )
}

/** A button of the pane's bar or the sheet's head: its icon and word (as the document's). */
export function BarBtn({ icon, label, pressed, onClick }: { icon: IconName; label: string; pressed?: boolean; onClick(e: MouseEvent<HTMLButtonElement>): void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 aria-pressed:bg-zinc-100 aria-pressed:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:bg-zinc-800 dark:aria-pressed:text-zinc-100"
    >
      <Icon n={icon} c="size-4" />
      <span>{label}</span>
    </button>
  )
}

/** An agent's proposed change: who, why, when; waiting (View changes), opened (Comment, Not now, Approve), or decided
 * (in place, faded, its buttons disabled, the one chosen in the past tense). */
export function ProposalCard({ p, open = false, desk, on }: { p: Proposal; open?: boolean; desk: boolean; on: { view(): void; comment(): void; notNow(): void; approve(): void } }) {
  const decided = p.decided
  const past: Record<string, string> = { Approve: 'Approved', 'Not now': 'Not now' }
  const btn = (label: 'Approve' | 'Not now', run: () => void, primary: boolean) =>
    decided ? (
      <button disabled className={decided === label ? DECIDED_ON(CHOSEN_TONE.Approve) : DECIDED_OFF}>
        {decided === label ? <Icon n="check" c="size-4" sw="2.5" /> : null}
        {decided === label ? past[label] : label}
      </button>
    ) : (
      <button onClick={run} className={primary ? APPROVE : SECOND}>
        {label}
      </button>
    )
  return (
    <div className={`${NEEDS_CARD} p-3 lg:px-4`}>
      <div className="flex items-start gap-2 text-sm">
        <span className="mt-0.5">
          <Avatar by={p.by} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b className="font-semibold">{name(p.by)} proposes a change</b>
            <span className={`text-xs ${MUTED}`}>{when(at(p.ago), Date.parse(at(0)))}</span>
          </div>
          <div className="text-amber-900 dark:text-amber-200">{p.why}</div>
        </div>
        {!open && !decided ? (
          <button onClick={on.view} className="h-9 shrink-0 rounded-lg bg-amber-100 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-400/15 dark:text-amber-100 dark:hover:bg-amber-400/25">
            {desk ? 'View changes' : 'View'}
          </button>
        ) : null}
      </div>
      {open || decided ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={on.comment} disabled={!!decided} title="Comment" className={`${decided ? DECIDED_OFF : SECOND} mr-auto lg:mr-0`}>
            <Icon n="comment" c="size-4" />
            {desk ? 'Comment' : null}
          </button>
          {btn('Not now', on.notNow, false)}
          {btn('Approve', on.approve, true)}
        </div>
      ) : null}
    </div>
  )
}

const MARK: Record<Chunk['mark'], string> = {
  '': '',
  added: 'rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-100',
  removed: 'rounded-md bg-red-50 px-2 py-0.5 text-red-700 line-through decoration-red-400 dark:bg-red-400/10 dark:text-red-300',
}

/** A version's text with what it changed from `before` marked in place: added on green, removed struck in red (or,
 * the marks off, the text as it was). */
export function ChangedText({ before, after, marks = true, world }: { before: string; after: string; marks?: boolean; world: InlineWorld }) {
  const chunks = marks ? diff(before, after) : [{ mark: '' as const, text: after }]
  return (
    <div className={`space-y-2 ${COLUMN}`}>
      {chunks.map((c, i) => (
        <div key={i} data-mark={c.mark || undefined} className={`${MARK[c.mark]} ${/^## /.test(c.text) ? 'pt-4' : ''}`}>
          {/^# /.test(c.text) ? <DocBlock b={{ kind: 'heading', text: c.text }} title world={world} /> : <Rich text={c.text} world={world} />}
        </div>
      ))}
    </div>
  )
}

const dayOf = (ago: number) => {
  const w = when(at(ago), Date.parse(at(0)))
  return /^\d/.test(w) ? 'Today' : w.startsWith('Yesterday') ? 'Yesterday' : w.replace(/ \d+:\d+$/, '')
}
const timeOf = (ago: number) => when(at(ago), Date.parse(at(0))).replace(/^(Yesterday|\w+ \d+) /, '')

/** The versions, newest first, by day: who, when, why, lines added and removed; the one shown picked, the newest "Now". */
export function VersionList({ versions, picked, on }: { versions: Version[]; picked: number | null; on: { pick(v: number): void } }) {
  const rows: ReactNode[] = []
  versions.forEach((x, i) => {
    const day = dayOf(x.ago)
    if (i === 0 || dayOf(versions[i - 1].ago) !== day)
      rows.push(
        <div key={'d' + day} className={`px-4 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase ${MUTED}`}>
          {day}
        </div>,
      )
    const prev = versions[i + 1]
    const c = prev ? counts(prev.md, x.md) : null
    rows.push(
      <button
        key={x.v}
        onClick={() => on.pick(x.v)}
        aria-current={picked === x.v || undefined}
        className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-zinc-100 aria-current:bg-zinc-100 dark:hover:bg-zinc-800/70 dark:aria-current:bg-zinc-800"
      >
        <span className="mt-0.5">
          <Avatar by={x.by === 'you' ? 'Y' : x.by} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <b className="font-semibold">{name(x.by)}</b>
            <span className={`text-xs ${MUTED}`}>{timeOf(x.ago)}</span>
            {i === 0 ? <span className="ml-auto rounded-md bg-zinc-200/70 px-1.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Now</span> : null}
          </span>
          {x.why ? <span className="block truncate text-zinc-700 dark:text-zinc-300">{x.why}</span> : null}
          <span className={`flex gap-2 text-xs tabular-nums ${MUTED}`}>
            <span>v{x.v}</span>
            {c ? <span className="text-emerald-600 dark:text-emerald-400">+{c.add}</span> : null}
            {c ? <span className="text-red-600 dark:text-red-400">−{c.del}</span> : null}
          </span>
        </span>
      </button>,
    )
  })
  return <div className="py-1">{rows}</div>
}

/** The one line under the editor's bar that becomes the version's note. */
export function WhyField({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <label className="flex h-11 items-center gap-3 border-b border-zinc-100 px-4 text-sm dark:border-zinc-800/70">
      <span className={`shrink-0 ${MUTED}`}>Why</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Optional" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
    </label>
  )
}

/** The version's own tools: changes shown or not, compared with now, restored. */
export function VersionTools({ marks, now, current, desk, on }: { marks: boolean; now: boolean; current: boolean; desk: boolean; on: { marks(): void; now(): void; restore(): void } }) {
  return (
    <>
      <BarBtn icon="check" label="Show changes" pressed={marks} onClick={on.marks} />
      {current ? null : <BarBtn icon="history" label="Compare with now" pressed={now} onClick={on.now} />}
      {desk ? (
        <button
          onClick={on.restore}
          disabled={current}
          className={`ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 ${DISABLED}`}
        >
          <Icon n="undo" c="size-4" />
          Restore this version
        </button>
      ) : null}
    </>
  )
}
