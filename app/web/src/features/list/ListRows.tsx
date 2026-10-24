// The item list's rows: an item (state icon, coloured code and title, one meta line), an item that waits on you (an
// amber bar, what the agent said, its one action on the thumb side), a row you just acted on (one quiet line), and the
// group heads. Props only: the list container works out what each row says.

import type { ReactNode, Ref } from 'react'
import { deskSlots, forward, backward, ACT_KEY, type Slot } from '../../model/actions'
import { closed, rowAction, shownStatus, statusWord } from '../../model/items'
import type { Item } from '../../model/types'
import { plural, whoName } from '../../model/words'
import { Avatar, Count, DraftMark, Hit, Pic, Soft } from '../../ui/bits'
import { Icon, StateIcon } from '../../ui/Icon'
import { ACT_BG, ACT_ICON, ACT_TONE, ACTION_PILL, FORWARD_NEED, NEED, PRI_TEXT, TYPE_TEXT } from '../../ui/tones'

/** What a row needs to know beyond its item. */
export interface RowFacts {
  code: string
  parentCode: string | null
  /** the first picture of what it was made from */
  image: { f: string; src: string } | null
  kids: { done: number; all: number } | null
  openKids: number
  talk: number
  draft: boolean
  next: boolean
  unread: boolean
  worker: { by: string; tip: string; quiet: boolean } | null
  /** where the searched words were found, when not in the title */
  hitLine: string | null
}

export interface RowEvents {
  open(n: number): void
  act(n: number, field: string, value: string, label: string): void
  need(n: number, action: string): void
  reopen(n: number): void
  fold(n: number): void
  goto(n: number): void
  picture(group: string, f: string): void
}

export interface RowLook {
  current: boolean
  selected: boolean
  words: readonly string[]
  desk: boolean
  /** being dragged, or where the dragged one would go: before, after or under it */
  drag?: 'dragging' | 'before' | 'after' | 'into'
}

/** A row's marks while an item is dragged. */
const dragMarks = (look: RowLook) => (look.drag === 'dragging' ? { 'data-dragging': '' } : look.drag ? { 'data-drop': look.drag } : {})

// The dark tints are opaque (the colours laid on the page's zinc-950): the row's buttons take the row's colour and
// hide the title under them. A picked row stays blue under the pointer and while pressed.
const ROW_TINT =
  'data-sel:bg-blue-100 dark:data-sel:bg-[color-mix(in_oklab,var(--color-blue-400)_20%,var(--color-zinc-950))] lg:data-sel:hover:bg-blue-100 dark:lg:data-sel:hover:bg-[color-mix(in_oklab,var(--color-blue-400)_20%,var(--color-zinc-950))] lg:hover:bg-zinc-50 dark:lg:hover:bg-[color-mix(in_oklab,var(--color-zinc-900)_70%,var(--color-zinc-950))] lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-[color-mix(in_oklab,var(--color-blue-400)_10%,var(--color-zinc-950))] pointer-coarse:transition-colors pointer-coarse:delay-75 data-pressed:bg-zinc-100 lg:data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-900 dark:lg:data-pressed:bg-zinc-900 data-sel:data-pressed:bg-blue-200 lg:data-sel:data-pressed:bg-blue-200 dark:data-sel:data-pressed:bg-[color-mix(in_oklab,var(--color-blue-400)_30%,var(--color-zinc-950))] dark:lg:data-sel:data-pressed:bg-[color-mix(in_oklab,var(--color-blue-400)_30%,var(--color-zinc-950))] lg:aria-[current=true]:data-pressed:bg-blue-100 dark:lg:aria-[current=true]:data-pressed:bg-[color-mix(in_oklab,var(--color-blue-400)_20%,var(--color-zinc-950))]'
// rows out of sight are not laid out until they scroll near (a long list shows at once)
export const ARTICLE =
  '[contain-intrinsic-size:auto_64px] [content-visibility:auto] relative border-b border-zinc-100 data-dragging:opacity-40 after:pointer-events-none after:absolute after:inset-0 after:z-10 data-[drop=before]:after:shadow-[inset_0_2px_0_0_var(--color-blue-500)] data-[drop=after]:after:shadow-[inset_0_-2px_0_0_var(--color-blue-500)] data-[drop=into]:after:bg-blue-500/10 data-[drop=into]:after:ring-2 data-[drop=into]:after:ring-blue-500 data-[drop=into]:after:ring-inset dark:border-zinc-800/70 dark:data-[drop=into]:after:bg-blue-400/15'
const PAD = ['pl-4', 'pl-10', 'pl-16', 'pl-22', 'pl-28', 'pl-34', 'pl-40', 'pl-46', 'pl-52']
const pad = (depth: number) => PAD[Math.min(depth, 8)]

const marks = (look: RowLook) => ({
  ...(look.current ? { 'aria-current': 'true' as const } : {}),
  ...(look.selected ? { 'data-sel': '' } : {}),
})

function CodeTitle({ it, code, look, struck }: { it: Item; code: string; look: RowLook; struck: boolean }) {
  return (
    <p className={`line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1 ${struck ? 'line-through decoration-zinc-400' : ''}`}>
      <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>
        <Hit text={code} words={look.words} />
      </span>
      <Hit text={it.title} words={look.words} />
    </p>
  )
}

function HitLine({ text, words }: { text: string | null; words: readonly string[] }) {
  return text ? (
    <p className="mt-0.5 line-clamp-1 text-[13px] text-zinc-500 dark:text-zinc-400">
      <Hit text={text} words={words} />
    </p>
  ) : null
}

/** The agent working on an item in progress; amber once it has gone quiet. */
function WorkerMark({ worker }: { worker: NonNullable<RowFacts['worker']> }) {
  return (
    <span
      aria-label={worker.tip}
      title={worker.tip}
      className={`inline-flex shrink-0 rounded-md ${worker.quiet ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
    >
      <Avatar by={worker.by} />
    </span>
  )
}

/** The desktop's quick actions, shown on hover over the end of the title, each in its own place. */
function RowActs({ it, needs, on }: { it: Item; needs: boolean; on: RowEvents }) {
  const acts = deskSlots(it, needs).filter((a): a is Slot => a !== null)
  return (
    <div className="relative hidden shrink-0 self-stretch bg-inherit lg:block">
      <div className="absolute inset-y-0 right-0 hidden items-center gap-0.5 bg-inherit [mask-image:linear-gradient(to_right,transparent,black_1.5rem)] pl-6 group-hover:flex">
        {acts.map(([f, v, label]) =>
          f === 'reopen' ? (
            <button
              key={label}
              title="Not yet · N"
              aria-label="Not yet"
              onClick={(e) => (e.stopPropagation(), on.reopen(it.n))}
              className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-900/7 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              <Icon n="reopen" c="size-[18px]" />
            </button>
          ) : (
            <button
              key={label}
              title={`${label}${ACT_KEY[label] ? ' · ' + ACT_KEY[label] : ''}`}
              aria-label={label}
              onClick={(e) => (e.stopPropagation(), on.act(it.n, f, v, label))}
              className={`grid size-8 place-items-center rounded-lg hover:bg-zinc-900/7 dark:hover:bg-white/10 ${ACT_TONE[label] || 'text-zinc-500 dark:text-zinc-400'}`}
            >
              <Icon n={ACT_ICON[label]} c="size-[18px]" />
            </button>
          ),
        )}
      </div>
    </div>
  )
}

/** The phone's swipe layers under a row: right, the step forward; left, the way back. */
function SwipeLayers({ it, openKids, on, children }: { it: Item; openKids: number; on: RowEvents; children: ReactNode }) {
  const fwd = forward(it)
  const back = backward(it)
  const left = fwd?.[1] === 'done' ? openKids : 0
  const need = fwd && FORWARD_NEED[fwd[2]]
  return (
    <div className="relative overflow-hidden">
      <div
        data-swipe-left
        hidden
        className={`absolute inset-0 flex items-center gap-2 pl-6 text-sm font-semibold ${need ? NEED[need].btn : 'bg-emerald-600 text-white dark:bg-emerald-500'}`}
      >
        {fwd ? (
          <>
            <Icon n={ACT_ICON[fwd[2]]} c="size-5" />
            {fwd[2]}
          </>
        ) : null}
        {left ? <span className="font-normal">· {plural(left, 'subitem')} still open</span> : null}
      </div>
      <div data-swipe-right hidden className="absolute inset-y-0 right-0 flex">
        {back.map(([f, v, label], i) => (
          <button
            key={label}
            onClick={() => (label === 'Not yet' ? on.reopen(it.n) : on.act(it.n, f, v, label))}
            className={`flex w-19 flex-col items-center justify-center gap-1 text-xs font-semibold text-white ${ACT_BG[label] || (i % 2 ? 'bg-zinc-500 dark:bg-zinc-600' : 'bg-zinc-600 dark:bg-zinc-700')}`}
          >
            <Icon n={ACT_ICON[label]} c="size-5" />
            {label}
          </button>
        ))}
      </div>
      <div data-swipe={it.n} className="relative touch-pan-y bg-white transition-transform duration-200 select-none [-webkit-touch-callout:none] dark:bg-zinc-950">
        {children}
      </div>
    </div>
  )
}

function Shell({ it, look, facts, on, rowRef, children }: { it: Item; look: RowLook; facts: RowFacts; on: RowEvents; rowRef?: Ref<HTMLElement>; children: ReactNode }) {
  return (
    <article ref={rowRef} data-n={it.n} {...dragMarks(look)} className={ARTICLE}>
      {it.type === 'rule' && look.desk ? (
        children
      ) : (
        <SwipeLayers it={it} openKids={facts.openKids} on={on}>
          {children}
        </SwipeLayers>
      )}
    </article>
  )
}

export function ItemRow(props: {
  it: Item
  depth: number
  band: string
  foldable: boolean
  folded: boolean
  facts: RowFacts
  look: RowLook
  on: RowEvents
  /** the row's element, for its height */
  rowRef?: Ref<HTMLElement>
}) {
  const { it, depth, band, foldable, folded, facts, look, on, rowRef } = props
  const isClosed = closed(it.status)
  const meta: ReactNode[] = [
    it.type === 'rule' ? null : (
      <span key="p" className={PRI_TEXT[it.pri]}>
        {it.pri}
      </span>
    ),
    facts.draft ? (
      <DraftMark key="s" />
    ) : it.status === 'doing' ? (
      <span key="s">In progress</span>
    ) : isClosed && band !== 'retired' ? (
      <span key="s">{statusWord(it)}</span>
    ) : it.talked && !isClosed ? (
      <span key="s">Your agent&apos;s turn</span>
    ) : null,
    it.when === 'later' && !isClosed && band !== 'later' ? (
      <Soft key="l">Later</Soft>
    ) : facts.next ? (
      <span key="l" className="font-semibold text-zinc-700 dark:text-zinc-200">
        Next
      </span>
    ) : null,
    it.parent && !depth && facts.parentCode ? (
      <button key="u" title="Part of" className="hover:underline" onClick={(e) => (e.stopPropagation(), on.goto(it.parent as number))}>
        ↳ {facts.parentCode}
      </button>
    ) : null,
    facts.kids ? (
      <Count key="c" icon="subitems" n={`${facts.kids.done}/${facts.kids.all}`} label="Subitems finished" />
    ) : facts.talk ? (
      <Count key="c" icon="comment" n={facts.talk} label={plural(facts.talk, 'comment')} />
    ) : null,
    it.status === 'doing' && facts.worker ? <WorkerMark key="w" worker={facts.worker} /> : null,
  ].filter(Boolean)
  return (
    <Shell it={it} look={look} facts={facts} on={on} rowRef={rowRef}>
      <div
        {...marks(look)}
        onClick={() => on.open(it.n)}
        className={`group relative flex cursor-pointer items-start gap-3 py-2.5 pr-3 ${pad(depth)} ${isClosed && !it.archived ? 'opacity-55' : ''} ${ROW_TINT}`}
      >
        {facts.unread ? <span className="absolute top-4.5 left-1 size-2 rounded-full bg-blue-600 dark:bg-blue-400" title="New from an agent" /> : null}
        <StateIcon {...shownStatus(it)} />
        <div className="min-w-0 flex-1">
          <CodeTitle it={it} code={facts.code} look={look} struck={isClosed && !it.archived} />
          <HitLine text={facts.hitLine} words={look.words} />
          {meta.length ? (
            <div className="mt-1 flex items-center gap-x-2.5 overflow-hidden text-xs font-medium whitespace-nowrap text-zinc-500 dark:text-zinc-400">
              {meta}
            </div>
          ) : null}
        </div>
        {it.type === 'rule' ? null : <RowActs it={it} needs={false} on={on} />}
        {facts.image ? (
          <button
            aria-label="View image"
            onClick={(e) => (e.stopPropagation(), on.picture('row' + it.n, (facts.image as { f: string }).f))}
            className="-my-0.5 grid size-11 shrink-0 place-items-center rounded-lg hover:brightness-95 dark:hover:brightness-110"
          >
            <span className="size-10 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
              <Pic src={facts.image.src} cls="size-full object-cover" />
            </span>
          </button>
        ) : null}
        {foldable ? (
          <button
            aria-expanded={!folded}
            aria-label={`${folded ? 'Show' : 'Hide'} subitems`}
            onClick={(e) => (e.stopPropagation(), on.fold(it.n))}
            className="-my-2 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Icon n={folded ? 'right' : 'down'} c="size-4" sw="2" />
          </button>
        ) : null}
      </div>
    </Shell>
  )
}

export function NeedsRow({ it, depth, facts, look, excerpt, on, rowRef }: { it: Item; depth: number; facts: RowFacts; look: RowLook; excerpt: string; on: RowEvents; rowRef?: Ref<HTMLElement> }) {
  const [v, label] = rowAction(it)
  return (
    <Shell it={it} look={look} facts={facts} on={on} rowRef={rowRef}>
      <div
        {...marks(look)}
        onClick={() => on.open(it.n)}
        className={`group relative flex cursor-pointer items-center gap-2.5 py-2.5 pr-3 ${pad(depth)} ${ROW_TINT}`}
      >
        <span className="absolute inset-y-0 left-0 w-1 bg-amber-500 dark:bg-amber-400" />
        <span className="self-start">
          <StateIcon {...shownStatus(it)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1">
            <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>
              <Hit text={facts.code} words={look.words} />
            </span>
            <Hit text={it.title} words={look.words} />
          </p>
          <HitLine text={facts.hitLine} words={look.words} />
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium">
            {it.type === 'rule' ? null : <span className={`shrink-0 ${PRI_TEXT[it.pri]}`}>{it.pri}</span>}
            {facts.draft ? <DraftMark /> : null}
            {it.when === 'later' ? (
              <span className="shrink-0">
                <Soft>Later</Soft>
              </span>
            ) : null}
            {it.parent && !depth && facts.parentCode ? (
              <button
                title="Part of"
                onClick={(e) => (e.stopPropagation(), on.goto(it.parent as number))}
                className="shrink-0 text-zinc-500 hover:underline dark:text-zinc-400"
              >
                ↳ {facts.parentCode}
              </button>
            ) : null}
            <span className="min-w-0 truncate font-normal text-zinc-500 dark:text-zinc-400">
              <Hit text={excerpt} words={look.words} />
            </span>
          </div>
        </div>
        {it.type === 'rule' ? null : <RowActs it={it} needs on={on} />}
        <button
          title={`${label} · A`}
          onClick={(e) => (e.stopPropagation(), on.need(it.n, v))}
          className="group/pill -my-1 grid h-11 shrink-0 place-items-center outline-none"
        >
          <span
            className={`${ACTION_PILL(v)} group-hover/pill:brightness-95 group-focus-visible/pill:outline-2 group-focus-visible/pill:outline-offset-2 group-focus-visible/pill:outline-blue-500 dark:group-hover/pill:brightness-125 dark:group-focus-visible/pill:outline-blue-400`}
          >
            <Icon n={NEED[v].icon} c="size-3.5" sw="2.25" />
            {label}
          </span>
        </button>
      </div>
    </Shell>
  )
}

/** A row you just acted on, while the list holds still: one quiet line saying what you did. */
export function HeldRow({ it, code, said, height, on }: { it: Item; code: string; said: string; height: number; on: RowEvents }) {
  return (
    <article data-n={it.n} className={ARTICLE}>
      <div
        onClick={() => on.open(it.n)}
        style={height > 0 ? { minHeight: height } : undefined}
        className="flex cursor-pointer items-center gap-3 py-2 pr-3 pl-4 text-sm text-zinc-500 hover:bg-zinc-50 data-pressed:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900/70 dark:data-pressed:bg-zinc-900"
      >
        <StateIcon {...shownStatus(it)} />
        <span className="min-w-0 flex-1 truncate">
          <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>{code}</span>
          {said}
        </span>
      </div>
    </article>
  )
}

const ZONE_STATE: Record<string, string> = { queue: 'doing', done: 'done', retired: 'dropped', archived: 'done' }

/** A group head: Needs you (amber), the agents' queue, Later, finished work, the rules' groups. */
export function Zone({ kind, label, n, right }: { kind: string; label: string; n: number; right?: ReactNode }) {
  const needs = kind === 'needs'
  const mark = needs ? (
    <span className="size-2 shrink-0 rounded-full bg-amber-500 ring-3 ring-amber-500/20 dark:bg-amber-400" />
  ) : kind === 'rules' ? (
    <span className="mx-1 size-2 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
  ) : kind === 'later' ? (
    <Icon n="clock" c="size-4 text-zinc-500 dark:text-zinc-400" sw="2" />
  ) : (
    <StateIcon s={ZONE_STATE[kind]} label={label} cls="size-4" />
  )
  return (
    <div data-zone={kind} className="flex h-9 items-center gap-2 border-y border-zinc-200 bg-zinc-100 pr-1 pl-4 dark:border-zinc-700/70 dark:bg-zinc-800">
      {mark}
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</h2>
      <span
        data-count
        className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${needs ? 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950' : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
      >
        {n}
      </span>
      {right}
    </div>
  )
}

/** Under a parent, one line for its subitems the view hides (Later, finished); a tap shows them. */
export function HiddenKidsLine({ depth, open, later, done, onToggle }: { depth: number; open: boolean; later: number; done: number; onToggle(): void }) {
  const said = later && done ? `${later + done} more: ${later} in Later, ${done} finished` : later ? `${later} more in Later` : `${done} more finished`
  return (
    <button
      aria-expanded={open}
      onClick={onToggle}
      className={`flex h-11 w-full items-center gap-1.5 border-b border-zinc-100 ${pad(depth)} text-[13px] font-semibold text-zinc-500 hover:bg-zinc-50 data-pressed:bg-zinc-100 lg:h-10 dark:border-zinc-800/70 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:data-pressed:bg-zinc-900`}
    >
      <Icon n={open ? 'chevup' : 'down'} c="size-4" sw="2.25" />
      {open ? 'Show fewer' : said}
    </button>
  )
}

export function NeedsMoreLine({ open, rest, onToggle }: { open: boolean; rest: number; onToggle(): void }) {
  return (
    <button
      onClick={onToggle}
      className="flex h-10 w-full items-center gap-1.5 border-b border-zinc-100 pl-4 text-[13px] font-semibold text-amber-800 hover:bg-amber-50 dark:border-zinc-800/70 dark:text-amber-300 dark:hover:bg-amber-400/10"
    >
      <Icon n={open ? 'chevup' : 'down'} c="size-4" sw="2.25" />
      {open ? 'Show fewer' : `Show ${rest} more`}
    </button>
  )
}

export function ArchiveAllLine({ n, onArchive }: { n: number; onArchive(): void }) {
  return (
    <div className="flex h-11 items-center border-b border-zinc-100 pr-1 pl-4 dark:border-zinc-800/70">
      <button onClick={onArchive} className="group/arch -my-1 ml-auto flex h-11 items-center pr-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-600/20 ring-inset group-hover/arch:bg-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25 dark:group-hover/arch:bg-emerald-400/20">
          <Icon n="archive" c="size-4" />
          Archive {n}
        </span>
      </button>
    </div>
  )
}

export const workerTip = (by: string, ses: string, quiet: boolean, ago: string) => {
  const who = whoName(by) + (ses ? ` · ${ses}` : '')
  return quiet ? `${who} · quiet ${ago}` : `${who} is on it`
}
