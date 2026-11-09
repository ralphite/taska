// The project's rules as one document (I693, r1116/r1118/r1128), drawn as Gemini designed them and Yadong approved:
// the bar's name and version, its buttons, an agent's proposal (waiting, opened, decided in place), the text with a
// version's changes marked in place (added on green, removed struck in red; one column, phone and desktop alike), the
// versions by day, the editor's "why" line, the question a restore asks once, and the rules when there are none yet.
// Props only.

import { useState, type MouseEvent, type ReactNode } from 'react'
import { foldRuns, type Chunk, type VersionRow } from '../../model/rules'
import type { RuleProposal } from '../../model/types'
import { hasIcon } from '../../model/words'
import { Avatar, Empty } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import type { SheetParts } from '../../ui/Sheet'
import { DECIDED_OFF, DECIDED_ON, DISABLED, MUTED, NEEDS_CARD, PRIMARY, PRIMARY_BASE, SECOND, chosenTone } from '../../ui/tones'
import { DocBlock } from './DocBlock'

/** the document's column, as DocView's */
export const RULES_COLUMN = 'lg:mx-auto lg:w-full lg:max-w-[min(46rem,calc(100%-5rem))]'
/** Approve, in Taska's Approve blue */
const APPROVE = `${PRIMARY_BASE} bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`

/** The bar's name: Rules, and what it shows (the version, who, when; Editing; a proposal). */
export function RulesHead({ sub }: { sub: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2 overflow-hidden text-sm">
      <Icon n="book" c="size-[18px] shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="shrink-0 font-semibold">Rules</span>
      {sub ? <span className={`truncate ${MUTED}`}>{sub}</span> : null}
    </span>
  )
}

/** A button of the pane's bar or the sheet's head: its icon and word. */
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

export interface ProposalFacts {
  p: RuleProposal
  who: string
  when: string
  /** the user's words on it and its agent's, newest last */
  talk: number
}

export interface ProposalEvents {
  view(): void
  comment(): void
  decline(): void
  approve(): void
}

/** An agent's proposed change: who, why, when; waiting (View changes), opened (Comment, Not now, Approve), or decided
 * (in place, faded, its buttons disabled, the one chosen in the past tense; r1003). Sent back: what changed since. */
export function ProposalCard({ f, open = false, on }: { f: ProposalFacts; open?: boolean; on: ProposalEvents }) {
  const { p } = f
  const decided = p.state === 'approved' ? 'Approve' : p.state === 'declined' ? 'Not now' : null
  const past: Record<string, string> = { Approve: 'Approved', 'Not now': 'Not now' }
  const btn = (label: 'Approve' | 'Not now', run: () => void, primary: boolean) =>
    decided || p.state === 'stale' ? (
      <button disabled className={decided === label ? DECIDED_ON(chosenTone('approve')) : DECIDED_OFF}>
        {decided === label ? <Icon n="check" c="size-4" sw="2.5" /> : null}
        {decided === label ? past[label] : label}
      </button>
    ) : (
      <button onClick={run} className={primary ? APPROVE : SECOND}>
        {label}
      </button>
    )
  return (
    <div data-proposal={p.id} className={`${NEEDS_CARD} p-3 lg:px-4`}>
      <div className="flex items-start gap-2 text-sm">
        <span className="mt-0.5">
          <Avatar by={p.by} named />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b className="font-semibold">{hasIcon(p.by) ? '' : `${f.who} `}proposes a change</b>
            <span className={`text-xs ${MUTED}`}>{f.when}</span>
          </div>
          <div className="text-amber-900 dark:text-amber-200">{p.why}</div>
          {p.state === 'stale' ? <div className={`mt-1 text-xs ${MUTED}`}>Sent back: {p.note?.replace(/^changed since: /, '') || 'the rules'} changed since</div> : null}
        </div>
        {!open && p.state === 'wait' ? (
          <button onClick={on.view} className="h-9 shrink-0 rounded-lg bg-amber-100 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-400/15 dark:text-amber-100 dark:hover:bg-amber-400/25">
            View changes
          </button>
        ) : null}
      </div>
      {open || decided ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={on.comment} disabled={!!decided || p.state === 'stale'} title="Comment" className={`${decided || p.state === 'stale' ? DECIDED_OFF : SECOND} mr-auto lg:mr-0`}>
            <Icon n="comment" c="size-4" />
            {f.talk ? f.talk : 'Comment'}
          </button>
          {btn('Not now', on.decline, false)}
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

/** A version's text with what it changed marked in place: added on green, removed struck in red (or, the marks off,
 * the text as it was). */
export function ChangedText({ chunks, world }: { chunks: readonly Chunk[]; world: InlineWorld }) {
  // the unchanged runs between the changes, folded, opened one by one
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())
  if (!chunks.length) return <Empty>Empty</Empty>
  const one = (c: Chunk, i: number) => (
    <div key={i} data-mark={c.mark || undefined} className={`${MARK[c.mark]} ${/^## /.test(c.text) && i && !c.mark ? 'pt-4' : ''}`}>
      {/^#/.test(c.text) ? <DocBlock b={{ kind: 'heading', text: c.text }} title={false} world={world} /> : <Rich text={c.text} world={world} />}
    </div>
  )
  return (
    <div className={`space-y-2 text-[15px] ${RULES_COLUMN}`}>
      {foldRuns(chunks).map((s, i) =>
        s.kind === 'chunk' ? (
          one(s.c, i)
        ) : open.has(i) ? (
          s.chunks.map((c, k) => one(c, i * 1000 + k))
        ) : (
          <button key={i} data-fold onClick={() => setOpen(new Set([...open, i]))} className={`flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-zinc-200 px-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${MUTED}`}>
            <Icon n="more" c="size-4" />
            {s.lines} unchanged lines
          </button>
        ),
      )}
    </div>
  )
}

/** The versions, newest first, by day: who, when, every why, lines added and removed; the one shown picked, the
 * newest "Now". */
export function VersionList({ rows, picked, on }: { rows: readonly VersionRow[]; picked: number | null; on: { pick(v: number): void } }) {
  const out: ReactNode[] = []
  rows.forEach((x, i) => {
    if (i === 0 || rows[i - 1].day !== x.day)
      out.push(
        <div key={'d' + x.day + i} className={`px-4 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase ${MUTED}`}>
          {x.day}
        </div>,
      )
    out.push(
      <button
        key={x.v}
        data-v={x.v}
        onClick={() => on.pick(x.v)}
        aria-current={picked === x.v || undefined}
        className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-zinc-100 aria-current:bg-zinc-100 dark:hover:bg-zinc-800/70 dark:aria-current:bg-zinc-800"
      >
        <span className="mt-0.5">
          <Avatar by={x.by === 'you' ? 'Y' : x.by} named />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            {hasIcon(x.by) ? null : <b className="truncate font-semibold">{x.who}</b>}
            <span className={`shrink-0 text-xs ${MUTED}`}>{x.time}</span>
            {x.now ? <span className="ml-auto shrink-0 rounded-md bg-zinc-200/70 px-1.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Now</span> : null}
          </span>
          {x.whys.map((w, k) => (
            <span key={k} className="block truncate text-zinc-700 dark:text-zinc-300">
              {w}
            </span>
          ))}
          <span className={`flex gap-2 text-xs tabular-nums ${MUTED}`}>
            <span>v{x.v}</span>
            {x.add ? <span className="text-emerald-600 dark:text-emerald-400">+{x.add}</span> : null}
            {x.del ? <span className="text-red-600 dark:text-red-400">−{x.del}</span> : null}
          </span>
        </span>
      </button>,
    )
  })
  return <div className="py-1">{out}</div>
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

/** A version's own tools: its changes shown or not, compared with now, restored (the desktop's; the phone's at the
 * foot). */
export function VersionTools({ marks, now, current, desk, on }: { marks: boolean; now: boolean; current: boolean; desk: boolean; on: { marks(): void; now(): void; restore(): void } }) {
  return (
    <>
      <BarBtn icon="check" label="Show changes" pressed={marks} onClick={on.marks} />
      {current ? null : <BarBtn icon="history" label="Compare with now" pressed={now} onClick={on.now} />}
      {desk ? (
        <button
          onClick={on.restore}
          disabled={current}
          className={`ml-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 ${DISABLED}`}
        >
          <Icon n="undo" c="size-4" />
          Restore this version
        </button>
      ) : null}
    </>
  )
}

/** The phone's Restore, at the foot of a version. */
export function RestoreFoot({ v, onRestore }: { v: number; onRestore(): void }) {
  return (
    <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
      <button onClick={onRestore} className={`${PRIMARY} w-full`}>
        <Icon n="undo" c="size-4" />
        Restore v{v}
      </button>
    </div>
  )
}

/** A restore asks once: it becomes the next version, nothing is lost. */
export function restoreAsk(v: number, next: number, on: { cancel(): void; restore(): void }): SheetParts {
  return {
    title: `Restore v${v}?`,
    body: <p className={`text-sm ${MUTED}`}>It becomes v{next}. Nothing is lost.</p>,
    foot: (
      <div className="flex justify-end gap-2 px-4 pt-1 pb-4">
        <button onClick={on.cancel} className={SECOND}>
          Cancel
        </button>
        <button onClick={on.restore} className={PRIMARY}>
          Restore v{v}
        </button>
      </div>
    ),
  }
}

/** No rules yet: what they are for, and the way to write them. */
export function NoRules({ onWrite }: { onWrite(): void }) {
  return (
    <div className={`flex flex-col items-center gap-3 py-12 text-center ${RULES_COLUMN}`}>
      <Icon n="book" c="size-8 text-zinc-300 dark:text-zinc-600" />
      <p className={`max-w-xs text-sm ${MUTED}`}>No rules yet. Agents read them before they work.</p>
      <button onClick={onWrite} className={PRIMARY}>
        <Icon n="pencil" c="size-4" />
        Write the rules
      </button>
    </div>
  )
}
