// The list of items (Items, Archive, Rules), in the order of your loop (T65 "Needs you first"): what waits on you,
// the agent's queue, Later, finished work, archived. Rows are swiped on the phone and dragged on the desktop.
import type { IconName } from '../lib/icons'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  ACT_BG,
  ACT_ICON,
  ACT_KEY,
  ACT_TONE,
  ACTION_PILL,
  FWD_NEED,
  LINK_BTN,
  NEED,
  NEEDS_SHOWN,
  PRI_TEXT,
  QUIET_MS,
  STATUS,
  TAB_NAME,
  TYPE_TEXT,
} from '../lib/constants'
import {
  CLOSED,
  U,
  bump,
  agoShort,
  byN,
  code,
  ctx,
  desk,
  els,
  excerpt,
  filesOf,
  filtered,
  hay,
  inQueue,
  inTab,
  inputMatch,
  kids,
  model,
  needsOrder,
  needsYou,
  plural,
  queueHead,
  sortQueue,
  render,
  searchWords,
  shownStatus,
  statusName,
  unread,
  useArea,
  visible,
  whoName,
} from '../lib/state'
import type { Item } from '../lib/types'
import { LIST, ROW_H, holding, listEnter, listLeave } from '../lib/listhold'
import { VW_STATE, isView, renameView, setFilters, type View } from '../lib/views'
import { openDialog, popAt } from '../lib/dialog'
import { hasDraft } from '../lib/drafts'
import { groups } from '../lib/markdown'
import { net, op, optimistic, notSaved, pushUndo, change } from '../lib/data'
import { toast } from '../lib/toast'
import {
  deskSlots,
  swipeCancel,
  swipeEnd,
  swipeLeft,
  swipeMove,
  swipeRight,
  swipeStart,
  openKidsOf,
  SW,
} from '../lib/rows'
import { Avatar, Cnt, DraftMark, Empty, Hit, Icon, ProjTile, Soft, StateIcon } from './ui'
import { SideList } from './SideList'

// B523: the dark tints are opaque, the same colours as before laid on the page's zinc-950: the row's buttons take the
// row's colour (bg-inherit) and must hide the title under them, which a see-through colour did not do
// D84 #1 #9: a picked row stays blue under the pointer and while pressed (a deeper blue), never the grey of an
// unpicked one; the buttons in a row darken its colour (List: RowActs), never a grey square on blue
const ROW_TINT =
  'data-sel:bg-blue-100 dark:data-sel:bg-[color-mix(in_oklab,var(--color-blue-400)_20%,var(--color-zinc-950))] lg:data-sel:hover:bg-blue-100 dark:lg:data-sel:hover:bg-[color-mix(in_oklab,var(--color-blue-400)_20%,var(--color-zinc-950))] lg:hover:bg-zinc-50 dark:lg:hover:bg-[color-mix(in_oklab,var(--color-zinc-900)_70%,var(--color-zinc-950))] lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-[color-mix(in_oklab,var(--color-blue-400)_10%,var(--color-zinc-950))] pointer-coarse:transition-colors pointer-coarse:delay-75 data-pressed:bg-zinc-100 lg:data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-900 dark:lg:data-pressed:bg-zinc-900 data-sel:data-pressed:bg-blue-200 lg:data-sel:data-pressed:bg-blue-200 dark:data-sel:data-pressed:bg-[color-mix(in_oklab,var(--color-blue-400)_30%,var(--color-zinc-950))] dark:lg:data-sel:data-pressed:bg-[color-mix(in_oklab,var(--color-blue-400)_30%,var(--color-zinc-950))] lg:aria-[current=true]:data-pressed:bg-blue-100 dark:lg:aria-[current=true]:data-pressed:bg-[color-mix(in_oklab,var(--color-blue-400)_20%,var(--color-zinc-950))]'
// T339: rows out of sight are not laid out until they scroll near (a long list shows at once). D84 #2: where a dragged
// row would go (above it, below it, under it) is drawn over the row, not under it: the row's own layer (its swipe
// cover, its picked or open colour) used to hide it
const ARTICLE =
  '[contain-intrinsic-size:auto_64px] [content-visibility:auto] relative border-b border-zinc-100 data-dragging:opacity-40 after:pointer-events-none after:absolute after:inset-0 after:z-10 data-[drop=before]:after:shadow-[inset_0_2px_0_0_var(--color-blue-500)] data-[drop=after]:after:shadow-[inset_0_-2px_0_0_var(--color-blue-500)] data-[drop=into]:after:bg-blue-500/10 data-[drop=into]:after:ring-2 data-[drop=into]:after:ring-blue-500 data-[drop=into]:after:ring-inset dark:border-zinc-800/70 dark:data-[drop=into]:after:bg-blue-400/15'
// aria-current: the open one; data-sel: picked with Cmd or Shift (T274 #34)
const rowCur = (it: Item) => ({
  ...(U.open === it.n ? { 'aria-current': 'true' as const } : {}),
  ...(U.sel.has(it.n) ? { 'data-sel': '' } : {}),
})

// F411: the one session of this agent seen in the last hour, by the title its app shows (none when there are several)
const onlySession = (by: string) => {
  const a = (model.S.agents || []).find((x) => x.name === by),
    recent = (a?.sessions || []).filter((x) => Date.now() - x.t < 3600e3)
  return recent.length === 1 ? recent[0].name : ''
}
// F194: the agent working on an item in progress; amber once it has gone quiet (T229 #1: the name is in the tip)
export function WorkerMark({ it }: { it: Item }) {
  const a = it.agent
  if (!a) return null
  const name = whoName(a.by),
    quiet = Date.now() - new Date(a.t).getTime()
  const ses = a.ses || onlySession(a.by) // F450: the session working on it; F411: else the only one seen lately
  const who = name + (ses ? ` · ${ses}` : '')
  const tip = quiet > QUIET_MS ? `${who} · quiet ${agoShort(new Date(a.t).getTime())}` : `${who} is on it`
  return (
    <span
      aria-label={tip}
      data-tip={tip}
      className={`inline-flex shrink-0 rounded-md ${quiet > QUIET_MS ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
    >
      <Avatar by={a.by} />
    </span>
  )
}
// The words found only in an item's text or thread: the line they are in, under the title
function HitLine({ it, shown = '' }: { it: Item; shown?: string }) {
  const words = searchWords(),
    title = (code(it.n) + ' ' + it.title + ' ' + shown).toLowerCase()
  const w = words.find((w) => !title.includes(w))
  if (!w) return null
  const text =
    [it.body, it.next, ...it.thread.map((x) => x.text)].find((t) => (t || '').toLowerCase().includes(w)) || ''
  const at = text.toLowerCase().indexOf(w),
    from = Math.max(0, at - 12)
  const line = ((from ? '…' : '') + text.slice(from, at + w.length + 80))
    .replace(/[*`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return line ? (
    <p className="mt-0.5 line-clamp-1 text-[13px] text-zinc-500 dark:text-zinc-400">
      <Hit text={line} />
    </p>
  ) : null
}
// B290: icons only, in the row. T438 #3: over the end of the title (in the row's own colour), so the title does not
// shrink under the pointer, and each in its own place, the same on every row (an empty place stays empty)
function RowActs({ it, needs = false }: { it: Item; needs?: boolean }) {
  const acts = deskSlots(it, needs).filter((a) => a !== null) // T475: side by side, no holes where one does not apply
  return (
    <div className="relative hidden shrink-0 self-stretch bg-inherit lg:block">
      {/* D84 #5: the title fades out under the buttons (their layer's left edge), never cut through a word */}
      <div className="absolute inset-y-0 right-0 hidden items-center gap-0.5 bg-inherit [mask-image:linear-gradient(to_right,transparent,black_1.5rem)] pl-6 group-hover:flex">
        {acts.map((a) =>
          a[0] === 'reopen' ? (
            <button
              key={a[2]}
              data-act="reopen"
              data-n={it.n}
              title="Not yet · N"
              aria-label="Not yet"
              className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-900/7 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              <Icon n="reopen" c="size-[18px]" />
            </button>
          ) : (
            <button
              key={a[2]}
              data-act="swipe"
              data-n={it.n}
              data-f={a[0]}
              data-v={a[1]}
              title={`${a[2]}${ACT_KEY[a[2]] ? ' · ' + ACT_KEY[a[2]] : ''}`}
              aria-label={a[2]}
              className={`grid size-8 place-items-center rounded-lg hover:bg-zinc-900/7 dark:hover:bg-white/10 ${ACT_TONE[a[2]] || 'text-zinc-500 dark:text-zinc-400'}`}
            >
              <Icon n={ACT_ICON[a[2]]} c="size-[18px]" />
            </button>
          ),
        )}
      </div>
    </div>
  )
}
// Phone quick actions: swipe right = the natural next step, swipe left = reveal buttons. Touch only.
function SwipeRow({ it, children }: { it: Item; children: ReactNode }) {
  const fwd = swipeRight(it),
    back = swipeLeft(it),
    left = fwd?.[1] === 'done' ? openKidsOf(it.n) : 0
  const need = fwd && FWD_NEED[fwd[2]]
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
            data-act={label === 'Not yet' ? 'reopen' : 'swipe'}
            data-n={it.n}
            data-f={f}
            data-v={v}
            className={`flex w-19 flex-col items-center justify-center gap-1 text-xs font-semibold text-white ${ACT_BG[label] || (i % 2 ? 'bg-zinc-500 dark:bg-zinc-600' : 'bg-zinc-600 dark:bg-zinc-700')}`}
          >
            <Icon n={ACT_ICON[label]} c="size-5" />
            {label}
          </button>
        ))}
      </div>
      <div
        data-swipe={it.n}
        className="relative touch-pan-y bg-white transition-transform duration-200 select-none [-webkit-touch-callout:none] dark:bg-zinc-950"
      >
        {children}
      </div>
    </div>
  )
}
// A row you just acted on, while the list holds still (B124): one quiet line with Undo (on the phone the toast's).
function HeldRow({ it, said }: { it: Item; said: string }) {
  if (!LIST_SETTLED.has(it.n)) LIST_SETTLED.set(it.n, Date.now())
  const h = (ROW_H.get(it.n) || 0) - 1
  return (
    <article data-n={it.n} data-settled={LIST_SETTLED.get(it.n)} className={ARTICLE}>
      <div
        data-act="open"
        data-n={it.n}
        style={h > 0 ? { minHeight: h } : undefined}
        className="flex cursor-pointer items-center gap-3 py-2 pr-3 pl-4 text-sm text-zinc-500 hover:bg-zinc-50 data-pressed:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900/70 dark:data-pressed:bg-zinc-900"
      >
        <StateIcon {...shownStatus(it)} />
        <span className="min-w-0 flex-1 truncate">
          <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>{code(it.n)}</span>
          {said}
        </span>
      </div>
    </article>
  )
}
const LIST_SETTLED = new Map<number, number>() // when each held row started holding (the phone's double tap, B148)

// A row in a list: state icon, coloured code and title, one meta line. Tapping anywhere opens the item (B62).
export function ItemRow({
  it,
  depth = 0,
  group = [],
  band = '',
  more = false,
}: {
  it: Item
  depth?: number
  group?: Item[]
  band?: string
  /** B532: subitems of it the view hides have their line under it (it folds them, as it folds the ones shown) */
  more?: boolean
}) {
  useArea('list') // drawn again while the list holds still, to show the line of the one you acted on (B124)
  it = byN.get(it.n) || it // T438 #3: while the list holds still, its rows show the items as they are now
  const held = U.settle.get(it.n)
  // T438 #3 (B8): a row you acted on that still belongs here is drawn as it is now, where it was; only one that left
  // the list stays as a quiet line saying what you did
  if (held && !visible().some((x) => x.n === it.n)) return <HeldRow it={byN.get(it.n) || it} said={held.said} />
  LIST_SETTLED.delete(it.n)
  const c = code(it.n),
    files = filesOf(it),
    children = kids.get(it.n) || [],
    closed = CLOSED(it.status),
    talk = it.thread.length
  const img = files.find((f) => (f.mime || '').startsWith('image/'))
  if (img) groups.set('row' + it.n, [img.f])
  const foldable = more || group.some((k) => k.parent === it.n)
  const meta: ReactNode[] = [
    it.type === 'rule' ? null : (
      <span key="p" className={PRI_TEXT[it.pri]}>
        {it.pri}
      </span>
    ),
    hasDraft(c) ? (
      <DraftMark key="s" />
    ) : it.status === 'doing' ? (
      <span key="s">In progress</span>
    ) : closed && band !== 'retired' ? (
      <span key="s">{statusName(it)}</span>
    ) : it.reply && !closed ? (
      <span key="s">Your agent&apos;s turn</span> // T438 #11: the words the item says at its top
    ) : null,
    it.when === 'later' && !closed && band !== 'later' ? (
      <Soft key="l">Later</Soft>
    ) : it.n === queueHead() ? (
      <span key="l" className="font-semibold text-zinc-700 dark:text-zinc-200">
        Next
      </span>
    ) : null,
    it.parent && !depth ? ( // F480: it opens what this belongs to
      <button key="u" data-act="goto" data-n={it.parent} title="Part of" className="hover:underline">
        ↳ {code(it.parent)}
      </button>
    ) : null,
    children.length ? (
      <Cnt
        key="c"
        icon="subitems"
        n={`${children.filter((k) => CLOSED(k.status)).length}/${children.length}`}
        label="Subitems finished"
      />
    ) : talk ? (
      <Cnt key="c" icon="comment" n={talk} label={plural(talk, 'comment')} />
    ) : null,
    it.status === 'doing' ? <WorkerMark key="w" it={it} /> : null,
  ].filter(Boolean)
  // B254: a subitem is set in 24 px a level
  const top = (
    <div
      data-act="open"
      data-n={it.n}
      {...rowCur(it)}
      className={`group relative flex cursor-pointer items-start gap-3 py-2.5 pr-3 ${PAD[Math.min(depth, 8)]} ${closed && !it.archived ? 'opacity-55' : ''} ${ROW_TINT}`}
    >
      {unread(it) ? (
        <span
          className="absolute top-4.5 left-1 size-2 rounded-full bg-blue-600 dark:bg-blue-400"
          title="New from an agent"
        />
      ) : null}
      <StateIcon {...shownStatus(it)} />
      <div className="min-w-0 flex-1">
        <p
          className={`line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1 ${closed && !it.archived ? 'line-through decoration-zinc-400' : ''}`}
        >
          <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>
            <Hit text={c} />
          </span>
          <Hit text={it.title} />
        </p>
        {U.q.trim() ? <HitLine it={it} /> : null}
        {meta.length ? (
          <div className="mt-1 flex items-center gap-x-2.5 overflow-hidden text-xs font-medium whitespace-nowrap text-zinc-500 dark:text-zinc-400">
            {meta}
          </div>
        ) : null}
      </div>
      {it.type === 'rule' ? null : <RowActs it={it} />}
      {img ? (
        <button
          data-act="view"
          data-g={'row' + it.n}
          data-f={img.f}
          aria-label="View image"
          className="-my-0.5 grid size-11 shrink-0 place-items-center rounded-lg hover:brightness-95 dark:hover:brightness-110"
        >
          <img
            src={`${ctx.P}f/${encodeURIComponent(img.f)}`}
            alt=""
            loading="lazy"
            className="size-10 rounded-lg border border-zinc-200 bg-zinc-50 object-cover dark:border-zinc-700 dark:bg-zinc-900"
          />
        </button>
      ) : null}
      {foldable ? (
        <button
          data-act="fold"
          data-n={it.n}
          aria-expanded={!U.folded.has(it.n)}
          aria-label={`${U.folded.has(it.n) ? 'Show' : 'Hide'} subitems`}
          className="-my-2 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <Icon n={U.folded.has(it.n) ? 'right' : 'down'} c="size-4" sw="2" />
        </button>
      ) : null}
    </div>
  )
  return (
    <article data-n={it.n} className={ARTICLE}>
      {it.type === 'rule' && desk() ? top : <SwipeRow it={it}>{top}</SwipeRow>}
    </article>
  )
}
const PAD = ['pl-4', 'pl-10', 'pl-16', 'pl-22', 'pl-28', 'pl-34', 'pl-40', 'pl-46', 'pl-52']

// A row that waits on you: an amber bar, what the agent said in one line, and the one action on the thumb side.
export function NeedsRow({ it, depth = 0 }: { it: Item; depth?: number }) {
  useArea('list') // drawn again while the list holds still, to show the line of the one you acted on (B124)
  it = byN.get(it.n) || it // T438 #3: while the list holds still, its rows show the items as they are now
  const held = U.settle.get(it.n)
  // T438 #3 (B8): a row you acted on that still belongs here is drawn as it is now, where it was; only one that left
  // the list stays as a quiet line saying what you did
  if (held && !visible().some((x) => x.n === it.n)) return <HeldRow it={byN.get(it.n) || it} said={held.said} />
  if (!needsYou(it)) return <ItemRow it={it} depth={depth} /> // T438 #3: no longer waiting on you: an ordinary row, where it was
  const [v, label] = rowAction(it)
  const ex = excerpt(it)
  const top = (
    <div
      data-act="open"
      data-n={it.n}
      {...rowCur(it)}
      className={`group relative flex cursor-pointer items-center gap-2.5 py-2.5 pr-3 ${PAD[Math.min(depth, 8)]} ${ROW_TINT}`}
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-amber-500 dark:bg-amber-400" />
      <span className="self-start">
        <StateIcon {...shownStatus(it)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1">
          <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>
            <Hit text={code(it.n)} />
          </span>
          <Hit text={it.title} />
        </p>
        {U.q.trim() ? <HitLine it={it} shown={ex} /> : null}
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium">
          {it.type === 'rule' ? null : <span className={`shrink-0 ${PRI_TEXT[it.pri]}`}>{it.pri}</span>}
          {hasDraft(code(it.n)) ? <DraftMark /> : null}
          {it.when === 'later' ? (
            <span className="shrink-0">
              <Soft>Later</Soft>
            </span>
          ) : null}
          {it.parent && !depth ? (
            <button
              data-act="goto"
              data-n={it.parent}
              title="Part of"
              className="shrink-0 text-zinc-500 hover:underline dark:text-zinc-400"
            >
              ↳ {code(it.parent)}
            </button>
          ) : null}
          <span className="min-w-0 truncate font-normal text-zinc-500 dark:text-zinc-400">
            <Hit text={ex} />
          </span>
        </div>
      </div>
      {it.type === 'rule' ? null : <RowActs it={it} needs />}
      <button
        data-act="row-act"
        data-n={it.n}
        data-v={v}
        title={`${label} · A`}
        className="group/pill -my-1 grid h-11 shrink-0 place-items-center outline-none"
      >
        {/* D84 #4: the keyboard's ring goes round the pill itself, not the taller square that only gives the finger room */}
        <span
          className={`${ACTION_PILL(v)} group-hover/pill:brightness-95 group-focus-visible/pill:outline-2 group-focus-visible/pill:outline-offset-2 group-focus-visible/pill:outline-blue-500 dark:group-hover/pill:brightness-125 dark:group-focus-visible/pill:outline-blue-400`}
        >
          <Icon n={NEED[v].icon} c="size-3.5" sw="2.25" />
          {label}
        </span>
      </button>
    </div>
  )
  return (
    <article data-n={it.n} className={ARTICLE}>
      {it.type === 'rule' && desk() ? top : <SwipeRow it={it}>{top}</SwipeRow>}
    </article>
  )
}
const rowAction = (it: Item): ['answer' | 'approve' | 'accept', string] =>
  it.wait ? ['answer', 'Answer'] : it.status === 'proposed' ? ['approve', 'Approve'] : ['accept', 'Accept']

// A group header: Needs you (amber), the agent's queue, Later, finished work, the rule groups (F210).
export function Zone({ kind, label, n, right }: { kind: string; label: string; n: number; right?: ReactNode }) {
  const needs = kind === 'needs'
  const mark = needs ? (
    <span className="size-2 shrink-0 rounded-full bg-amber-500 ring-3 ring-amber-500/20 dark:bg-amber-400" />
  ) : kind === 'rules' ? (
    <span className="mx-1 size-2 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
  ) : kind === 'later' ? (
    <Icon n="clock" c="size-4 text-zinc-500 dark:text-zinc-400" sw="2" />
  ) : (
    <StateIcon
      s={({ queue: 'doing', done: 'done', retired: 'dropped', archived: 'done' } as Record<string, string>)[kind]}
      label={label}
      cls="size-4"
    />
  )
  return (
    <div
      data-zone={kind}
      className="flex h-9 items-center gap-2 border-y border-zinc-200 bg-zinc-100 pr-1 pl-4 dark:border-zinc-700/70 dark:bg-zinc-800"
    >
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
const ArchiveAllBtn = ({ n }: { n: number }) => (
  <button data-act="archive-all" className="group/arch -my-1 ml-auto flex h-11 items-center pr-2">
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-600/20 ring-inset group-hover/arch:bg-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25 dark:group-hover/arch:bg-emerald-400/20">
      <Icon n="archive" c="size-4" />
      Archive {n}
    </span>
  </button>
)
// What waits on you, at the top of Rules. F209: on the desktop the first 5 and a row for the rest; not when the open one
// is in the rest.
function NeedsBand({ needs }: { needs: Item[] }) {
  if (!needs.length) return null // nothing waiting: no band (I71)
  const long = desk() && needs.length > NEEDS_SHOWN + 1,
    cut = long && !U.needsAll && !needs.slice(NEEDS_SHOWN).some((it) => it.n === U.open)
  const rest = needs.length - NEEDS_SHOWN
  const toggle = (label: string, icon: IconName) => (
    <button
      data-act="needs-more"
      className="flex h-10 w-full items-center gap-1.5 border-b border-zinc-100 pl-4 text-[13px] font-semibold text-amber-800 hover:bg-amber-50 dark:border-zinc-800/70 dark:text-amber-300 dark:hover:bg-amber-400/10"
    >
      <Icon n={icon} c="size-4" sw="2.25" />
      {label}
    </button>
  )
  return (
    <>
      <Zone kind="needs" label="Needs you" n={needs.filter(needsYou).length} />
      {(cut ? needs.slice(0, NEEDS_SHOWN) : needs).map((it) => (
        <NeedsRow key={it.n} it={it} />
      ))}
      {cut ? toggle(`Show ${rest} more`, 'down') : long && U.needsAll ? toggle('Show fewer', 'chevup') : null}
    </>
  )
}
// B532 (r760): under a parent, one grey line for its subitems the view hides (Active hides Later and finished ones), at
// their level, as the Needs-you band's "Show N more"; a tap shows them as the All view draws them, and it reads Show fewer
function HiddenKids({ n, more, open, depth }: { n: number; more: Item[]; open: boolean; depth: number }) {
  const later = more.filter((k) => !CLOSED(k.status)).length,
    done = more.length - later
  const said =
    later && done
      ? `${more.length} more: ${later} in Later, ${done} finished`
      : later
        ? `${later} more in Later`
        : `${done} more finished`
  return (
    <button
      data-act="sub-more"
      data-n={n}
      aria-expanded={open}
      className={`flex h-11 w-full items-center gap-1.5 border-b border-zinc-100 ${PAD[Math.min(depth, 8)]} text-[13px] font-semibold text-zinc-500 hover:bg-zinc-50 data-pressed:bg-zinc-100 lg:h-10 dark:border-zinc-800/70 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:data-pressed:bg-zinc-900`}
    >
      <Icon n={open ? 'chevup' : 'down'} c="size-4" sw="2.25" />
      {open ? 'Show fewer' : said}
    </button>
  )
}
function Tree({
  group,
  band = '',
  needs = false,
  hidden,
}: {
  group: Item[]
  band?: string
  needs?: boolean
  /** B532: each parent's subitems the view hides, for its line */
  hidden?: Map<number, Item[]>
}) {
  const inG = new Set(group.map((it) => it.n)),
    out: ReactNode[] = []
  const add = (it: Item, d: number) => {
    const more = hidden?.get(it.n)
    out.push(
      needs && needsYou(it) ? (
        <NeedsRow key={it.n} it={it} depth={d} />
      ) : (
        <ItemRow key={it.n} it={it} depth={d} group={group} band={band} more={!!more} />
      ),
    )
    if (U.folded.has(it.n) || d >= 8) return
    for (const k of group) if (k.parent === it.n) add(k, d + 1) // with the hidden ones, once shown
    if (more) out.push(<HiddenKids key={`more${it.n}`} n={it.n} more={more} open={U.subMore.has(it.n)} depth={d + 1} />)
  }
  for (const it of group) if (!(it.parent && inG.has(it.parent))) add(it, 0)
  return <>{out}</>
}

// ---------------------------------------------------------------- F291: one tree, and preset views on top
// F291 (r397): Active first and by default: what agents are on or will take (not finished, archived or later).
// 'all' stays the default value, so addresses and the other tabs are as before; All itself is 'every'.
const VIEWS: [string, string][] = [
  ['wait', 'Needs you'],
  ['all', 'Active'],
  ['every', 'All'],
  ['archive', 'Archive'],
  ['queued', 'Queue'],
  ['later', 'Later'],
  ['closed', 'Finished'],
] // in Yadong's order (r399; F486: Needs you first, Archive after All); Active stays the one shown first
const unfinished = (rows: Item[]) => rows.filter((it) => !CLOSED(it.status))
// A9 (T422): the Archive view counts what it would show with the filters and search set now
function archiveCount() {
  const was = U.status
  if (U.tab !== 'archive') U.status = 'all'
  try {
    return visible('archive').length
  } finally {
    U.status = was
  }
}
function viewCount(v: string | View) {
  const was = { type: U.type, when: U.when, status: U.status, pri: U.pri, sort: U.sort },
    tab = U.tab
  U.tab = 'items' // F348: counted as Items shows it, from the Archive view too
  if (typeof v === 'string') {
    if (tab !== 'items') setFilters({ type: 'all', when: 'all', status: v, pri: 'all', sort: 'all' })
    else U.status = v
  } else setFilters(v)
  try {
    return visible('items').length
  } finally {
    U.tab = tab
    setFilters(was)
  }
}
const CHIP =
  'flex h-8 shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900'
// F320: one of your views: a click shows it; right-click (or hold on the phone) renames, updates or deletes it
function OwnView({ v, i, on }: { v: View; i: number; on: boolean }) {
  const hold = useRef(0)
  if (VW_STATE.edit === i)
    return (
      <input
        autoFocus
        defaultValue={v.name}
        aria-label="View name"
        onKeyDown={(e) => {
          if (e.key === 'Enter') renameView(i, e.currentTarget.value)
          if (e.key === 'Escape') {
            VW_STATE.edit = -1
            bump('list')
          }
        }}
        onBlur={(e) => renameView(i, e.currentTarget.value)}
        className="h-8 w-32 shrink-0 rounded-full bg-white px-3 text-[13px] ring-2 ring-blue-500 outline-none dark:bg-zinc-900"
      />
    )
  const menu = (x: number, y: number) => {
    openDialog('view-menu', { i }, { pop: true, focus: false })
    popAt(x, y)
  }
  return (
    <button
      data-act="view-use"
      data-i={i}
      aria-pressed={on}
      onContextMenu={(e) => {
        e.preventDefault()
        menu(e.clientX, e.clientY)
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        const { clientX: x, clientY: y } = e
        hold.current = window.setTimeout(() => menu(x, y + 8), 500)
      }}
      onPointerUp={() => clearTimeout(hold.current)}
      onPointerLeave={() => clearTimeout(hold.current)}
      className={CHIP}
    >
      {v.name}
      <span className="font-mono text-[11px] tabular-nums opacity-60">{viewCount(v)}</span>
    </button>
  )
}
// T322 #2: the row scrolls sideways; an arrow on a fading edge says more is there, and a click brings it in
function ViewBar() {
  useArea('list') // A10 (T422): its counts change at once, also while the rows hold still (B124)
  const row = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  const measure = () => {
    const el = row.current
    if (!el) return
    const l = el.scrollLeft > 1,
      r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }))
  }
  useLayoutEffect(measure)
  useEffect(() => {
    // B343: its own width changes too when the list is dragged wider or narrower, not only the window
    const el = row.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const own = VW_STATE.list.findIndex(isView) // F320: one of your views is what shows
  const on = U.tab === 'archive' ? 'archive' : own >= 0 ? `own${own}` : U.status
  useEffect(() => {
    // the view that shows is never hidden past the edge or under an arrow (48px wide)
    const el = row.current,
      b = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !b) return
    const l = b.offsetLeft - 48,
      r = b.offsetLeft + b.offsetWidth + 48 - el.clientWidth
    if (el.scrollLeft > l) el.scrollLeft = Math.max(0, l)
    else if (el.scrollLeft < r) el.scrollLeft = r
  }, [on])
  const go = (dir: number) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.7, behavior: 'smooth' })
  const arrow = (dir: number) => (
    <button
      aria-label={dir < 0 ? 'Earlier views' : 'More views'}
      onClick={() => go(dir)}
      className={`absolute inset-y-0 z-10 flex w-12 items-center from-white from-50% to-transparent dark:from-zinc-950 ${dir < 0 ? 'left-0 justify-start bg-linear-to-r pl-1' : 'right-0 justify-end bg-linear-to-l pr-1'}`}
    >
      <span className="grid size-7 place-items-center rounded-full bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-700">
        <Icon n={dir < 0 ? 'left' : 'right'} c="size-4" sw="2.25" />
      </span>
    </button>
  )
  return (
    <div className="relative border-b border-zinc-200 dark:border-zinc-800">
      <div
        ref={row}
        data-views
        onScroll={measure}
        className="flex h-12 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-2"
      >
        {VIEWS.map(([v, label]) => {
          if (v === 'archive')
            return (
              // F348: the archive is one of the views
              <button key={v} data-act="tab" data-tab="archive" aria-pressed={U.tab === 'archive'} className={CHIP}>
                {label}
                <span className="font-mono text-[11px] tabular-nums opacity-60">{archiveCount()}</span>
              </button>
            )
          const n = viewCount(v)
          return (
            <button
              key={v}
              data-act="set-filter"
              data-k="status"
              data-v={v}
              data-views
              aria-pressed={U.tab === 'items' && U.status === v && own < 0}
              className={CHIP}
            >
              {v === 'wait' && n ? <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400" /> : null}
              {label}
              <span className="font-mono text-[11px] tabular-nums opacity-60">{n}</span>
            </button>
          )
        })}
        {VW_STATE.list.map((v, i) => (
          <OwnView key={v.name} v={v} i={i} on={U.tab === 'items' && i === own} />
        ))}
      </div>
      {edge.l ? arrow(-1) : null}
      {edge.r ? arrow(1) : null}
    </div>
  )
}
const latestFirst = (a: Item, b: Item) => String(b.t1).localeCompare(String(a.t1)) || b.n - a.n
// the order agents take the work: in progress first, now before later, priority, your order, the oldest first;
// finished work after the rest, the latest first
const workOrder = (all: Item[]) => [
  ...sortQueue(unfinished(all)),
  ...all.filter((it) => CLOSED(it.status)).sort(latestFirst),
]
/** B532 (r760): the subitems Active hides (in Later, finished) under each parent it shows, in the All view's order;
 * those under a parent whose line you tapped join the rows (and their own hidden ones, under them). From the same
 * subitems the counts are made of (kids), so the list and the item page tell the same. */
const SUB_SHOWN = new Set<number>() // the hidden subitems shown now, rows of the list like the others
function hiddenKids(rows: Item[]) {
  const hidden = new Map<number, Item[]>(),
    group = [...rows]
  SUB_SHOWN.clear()
  if (U.status !== 'all' || filtered()) return { group, hidden } // only the plain Active view hides them
  const shown = new Set(rows.map((it) => it.n))
  for (let i = 0; i < group.length; i++) {
    const p = group[i],
      more = workOrder((kids.get(p.n) || []).filter((k) => !shown.has(k.n) && (CLOSED(k.status) || k.when === 'later')))
    if (!more.length) continue
    hidden.set(p.n, more)
    if (U.subMore.has(p.n))
      for (const k of more) {
        shown.add(k.n)
        SUB_SHOWN.add(k.n)
        group.push(k)
      }
  }
  return { group, hidden }
}
function treeBody(all: Item[]): { body: ReactNode; shown: number } {
  const rows =
    U.status === 'closed'
      ? [...all].sort(latestFirst)
      : U.status === 'wait'
        ? [...all].sort(needsOrder) // what needs you, the newest first (B238)
        : workOrder(all) // Active, All, Queue, Later
  const { group, hidden } = hiddenKids(rows)
  return {
    body: (
      <>
        <ViewBar />
        {U.status === 'closed' && rows.some((it) => !it.archived && CLOSED(it.status)) ? (
          <div className="flex h-11 items-center border-b border-zinc-100 pr-1 pl-4 dark:border-zinc-800/70">
            <ArchiveAllBtn n={rows.filter((it) => !it.archived && CLOSED(it.status)).length} />
          </div>
        ) : null}
        {rows.length ? (
          <Tree group={group} hidden={hidden} needs />
        ) : searchWords().length || U.type !== 'all' || U.pri !== 'all' ? (
          <Empty>
            No matching items
            <span className="mt-3 flex flex-col">
              <SearchHints shown={0} />
            </span>
            <button data-act="reset" className="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">
              Clear search and filters
            </button>
          </Empty>
        ) : (
          <Empty>
            {U.status === 'wait'
              ? 'Nothing needs you.'
              : U.status === 'closed'
                ? 'Nothing finished yet.'
                : 'Nothing here.'}
          </Empty>
        )}
      </>
    ),
    shown: rows.length,
  }
}

// ---------------------------------------------------------------- search hints (A9, B15, F196)
// D82 #7: the search in the other projects says it is searching, that it found nothing there, or that it could not
// search: never nothing at all, which read as "the other projects have none"
const XS = { q: '', list: null as null | CrossHit[], timer: 0, failed: false }
interface CrossHit {
  project: string
  ptitle?: string
  kind: string
  code: string
  title: string
  archived?: boolean
  status?: string
}
function crossSearch() {
  const q = searchWords().join(' ')
  if (q === XS.q) return
  XS.q = q
  XS.list = null
  XS.failed = false
  clearTimeout(XS.timer)
  if (!q) return
  XS.timer = window.setTimeout(async () => {
    try {
      const r = await net<CrossHit[]>(
        `/api/search?q=${encodeURIComponent(q)}&skip=${encodeURIComponent(model.S.project)}`,
      )
      if (XS.q === q) {
        XS.list = r
        render()
      }
    } catch {
      if (XS.q === q) {
        XS.failed = true
        render()
      }
    }
  }, 300)
}
function CrossHits() {
  const now = XS.q === searchWords().join(' '),
    list = now ? XS.list : null
  if (!now || !XS.q) return null
  if (!list?.length)
    return (
      <p
        data-cross={XS.failed ? 'failed' : list ? 'none' : 'searching'}
        className="mt-4 px-3 text-center text-xs text-zinc-500 dark:text-zinc-400"
      >
        {XS.failed
          ? "Couldn't search the other projects"
          : list
            ? 'Not in other projects'
            : 'Searching the other projects\u2026'}
      </p>
    )
  return (
    <div className="mx-auto mt-4 w-full max-w-xl px-2 text-left">
      <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
        In other projects · {list.length}
        {list.length === 30 ? '+' : ''}
      </p>
      {list.slice(0, 8).map((x) => (
        <a
          key={x.project + x.code}
          href={`/p/${encodeURIComponent(x.project)}/${x.kind === 'input' ? 'inputs?q=' + encodeURIComponent(XS.q) : encodeURIComponent(x.code)}`}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <ProjTile name={x.project} cls="size-5 rounded text-[10px]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">
              <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">{x.code}</span> {x.title}
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {x.ptitle || x.project}
              {x.kind === 'input'
                ? ' · what you said'
                : x.archived
                  ? ' · archived'
                  : CLOSED(x.status || '')
                    ? ` · ${STATUS[x.status as 'done'] || x.status}`
                    : ''}
            </span>
          </span>
        </a>
      ))}
      {list.length > 8 ? (
        <p className="px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">
          and {list.length - 8} more: a longer search narrows them
        </p>
      ) : null}
    </div>
  )
}
export function SearchHints({ shown }: { shown: number }) {
  const words = searchWords()
  crossSearch()
  if (!words.length) return null
  const S = model.S
  const other =
    shown >= 5
      ? []
      : (['items', 'inputs', 'archive', 'rules'] as const)
          .filter((t) => t !== U.tab)
          .map(
            (t) =>
              [
                t,
                t === 'inputs'
                  ? S.inputs.filter((r) => inputMatch(r, words)).length
                  : S.items.filter((it) => !it.merged_into && inTab(it, t) && words.every((w) => hay(it).includes(w)))
                      .length,
              ] as const,
          )
          .filter(([, n]) => n)
  return (
    <>
      {other.map(([t, n]) => (
        <p key={t} className="flex items-center justify-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          {n === 1 ? '1 match' : `${n} matches`} in {TAB_NAME[t]}
          <button data-act="search-in" data-tab={t} className={LINK_BTN}>
            Show
          </button>
        </p>
      ))}
      <CrossHits />
    </>
  )
}
const SEL_ACTS: [string, string, string, string][] = [
  ['status', '"done"', 'Done', 'are done'],
  ['when', '"later"', 'Later', 'moved to Later'],
  ['when', '"now"', 'Now', 'are back to now'],
  ['archived', 'true', 'Archive', 'archived'],
  ['status', '"dropped"', "Won't do", "are marked won't do"],
]
function SelBar() {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-blue-200 bg-blue-50 py-1.5 pr-2 pl-4 dark:border-blue-400/25 dark:bg-zinc-900">
      <span className="mr-auto text-sm font-semibold whitespace-nowrap text-blue-950 dark:text-blue-100">
        {U.sel.size} selected
      </span>
      {SEL_ACTS.map(([f, v, label, said]) => (
        <button
          key={label}
          data-act="sel-do"
          data-f={f}
          data-v={v}
          data-said={said}
          className="flex h-8 items-center rounded-lg px-2 text-[13px] font-medium whitespace-nowrap text-zinc-700 hover:bg-white dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {label}
        </button>
      ))}
      <button
        data-act="sel-clear"
        title="Clear · Esc"
        aria-label="Clear the selection"
        className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
      >
        <Icon n="x" c="size-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- the list
let frozen: ReactNode = null // what the list showed while rows hold still (B124)
function listBody(): { body: ReactNode; shown: number } {
  const S = model.S,
    rows = visible()
  if (!S.items.length && U.tab === 'rules')
    return {
      body: <Empty>No rules</Empty>,
      shown: 0,
    }
  if (!S.items.length && U.tab === 'archive')
    return {
      body: <Empty>Nothing archived</Empty>,
      shown: 0,
    }
  if (!S.items.length)
    return {
      body: (
        <Empty>
          No items yet.
          <br />
          Write your first thought below
          {S.org?.on ? ' and the organizer turns it into items' : ' and your coding agent turns it into items'}.
          <br />
          <button data-act="guide" className="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">
            Connect a coding agent
          </button>
        </Empty>
      ),
      shown: 0,
    }
  if (U.tab === 'items' && U.sort === 'all') return treeBody(rows)
  if (!rows.length && filtered())
    return {
      body: (
        <Empty>
          {U.tab === 'rules' ? 'No matching rules' : 'No matching items'}
          <span className="mt-3 flex flex-col">
            <SearchHints shown={0} />
          </span>
          <button data-act="reset" className="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">
            Clear search and filters
          </button>
        </Empty>
      ),
      shown: 0,
    }
  if (U.tab === 'rules') {
    // the ones that wait on you (an agent proposed it, or asks about it) first, each the Needs-you row, as everywhere
    // (B555 r802); then the rules in force, then the retired ones (T113 B29)
    const wait = rows.filter((it) => it.status === 'proposed' || needsYou(it)).sort(needsOrder),
      on = rows.filter((it) => it.status === 'open' && !needsYou(it)),
      off = rows.filter((it) => it.status === 'dropped' && !needsYou(it))
    return {
      body: !rows.length ? (
        <Empty>No rules</Empty>
      ) : (
        <>
          <NeedsBand needs={wait} />
          {on.length ? (
            <>
              <Zone kind="rules" label="Active" n={on.length} />
              {on.map((it) => (
                <ItemRow key={it.n} it={it} />
              ))}
            </>
          ) : null}
          {off.length ? (
            <>
              <Zone kind="retired" label="Retired" n={off.length} />
              {off.map((it) => (
                <ItemRow key={it.n} it={it} band="retired" />
              ))}
            </>
          ) : null}
        </>
      ),
      shown: rows.length,
    }
  }
  // Archive, or Items sorted another way (T274 #36): the list in that order; what waits on you is the Needs-you row
  // there too, its Approve, Accept or Answer the button on its right, as in every other list (B555 r802)
  return {
    body: (
      <>
        {U.tab === 'archive' ? <ViewBar /> : null}
        {rows.length ? (
          rows.map((it) => (needsYou(it) ? <NeedsRow key={it.n} it={it} /> : <ItemRow key={it.n} it={it} />))
        ) : (
          <Empty>{U.tab === 'archive' ? 'Nothing archived' : 'No items'}</Empty>
        )}
      </>
    ),
    shown: rows.length,
  }
}

// ---------------------------------------------------------------- dragging a row (desktop, mouse only)
const DRAG = { n: 0, at: null as null | { el?: HTMLElement; n?: number; how: string } }
/** F397: the item being dragged, for the sidebar: dropped on another project, it moves there */
export const ITEM_DRAG = DRAG
const queuedNow = (it: Item) => inQueue(it) && it.when === 'now'
function dropAt(e: DragEvent) {
  const it = byN.get(DRAG.n),
    t0 = e.target as Element,
    el = t0.closest<HTMLElement>('#list article[data-n]')
  if (!it) return null
  if (!el) return it.parent && t0.closest('#list') ? { how: 'out' } : null
  const n = Number(el.dataset.n),
    t = byN.get(n)
  if (!t || n === DRAG.n || t.type === 'rule' || CLOSED(t.status)) return null
  for (let p = t.parent; p; p = byN.get(p)?.parent ?? null) if (p === DRAG.n) return null // not under one of its own subitems
  const r = el.getBoundingClientRect(),
    y = (e.clientY - r.top) / r.height,
    line = queuedNow(it) && queuedNow(t)
  return { el, n, how: line && y < 0.3 ? 'before' : line && y > 0.7 ? 'after' : 'into' }
}
function dropMark(at: typeof DRAG.at) {
  if (DRAG.at?.el && DRAG.at.el !== at?.el) delete DRAG.at.el.dataset.drop
  if (at?.el) at.el.dataset.drop = at.how
  els.list?.toggleAttribute('data-drop-out', at?.how === 'out')
  DRAG.at = at
}
function dragMove(n: number, at: { n?: number; how: string }): unknown {
  const it = byN.get(n),
    ref = code(n)
  if (!it) return
  if (at.how === 'into') return change(n, 'parent', at.n)
  if (at.how === 'out') return change(n, 'parent', null)
  const t = byN.get(at.n as number)
  if (!t) return
  // F291: anywhere in the queue, whatever the priorities: your order comes first, and the priority stays as it was
  const group = sortQueue(model.S.items.filter((x) => queuedNow(x) && x.n !== n))
  group.splice(group.indexOf(t) + (at.how === 'after' ? 1 : 0), 0, it)
  const patches = group
    .map((x, i) => ({ n: x.n, f: { rank: i } as Record<string, unknown> }))
    .filter((p) => byN.get(p.n)?.rank !== p.f.rank)
  const before = patches.map((p) => ({
    n: p.n,
    f: Object.fromEntries(
      Object.keys(p.f).map((k) => [k, (byN.get(p.n) as unknown as Record<string, unknown>)[k] ?? null]),
    ),
  }))
  const send = (list: typeof patches) => () => op(list.map((p) => ({ op: 'set', ref: code(p.n), f: p.f })))
  const run = pushUndo(`${ref} moved`, () => {
    toast(`${ref} put back`)
    return optimistic(before, send(before), (ex) => notSaved(ex, run))
  })
  toast(
    `${ref} ${at.how === 'after' ? 'after' : 'before'} ${code(at.n as number)}${it.pri !== t.pri ? `, now ${t.pri}` : ''}`,
    run,
  )
  return optimistic(patches, send(patches), (ex) => notSaved(ex, () => dragMove(n, at)))
}

export function List() {
  useArea('list')
  return desk() && U.side ? <SideList side={U.side} /> : <ItemList /> // T402
}
function ItemList() {
  useArea('list')
  const ref = useRef<HTMLDivElement>(null)
  const top = useRef(0)
  // the rows are drawn from the state; while one holds still (B124) the list keeps the order it had
  let body: ReactNode, shown: number
  const keep = holding() && frozen
  if (keep) {
    body = frozen
    shown = 0
  } else {
    ;({ body, shown } = listBody())
    frozen = body
  }
  if (U.sel.size) {
    const there = new Set([...visible().map((it) => it.n), ...SUB_SHOWN])
    for (const n of U.sel) if (!there.has(n)) U.sel.delete(n) // picked rows that left the list are let go
  }
  SW.open = SW.el = null // rows are drawn closed; a stale reference would swallow the next tap
  useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    // keep the place: under the phone's item page the list is hidden and reads 0
    if (!(U.open && !desk())) list.scrollTop = top.current
    if (desk() && U.open) {
      const rows = [...list.querySelectorAll<HTMLElement>('[data-act="open"][data-n]')].map((el) =>
        Number(el.dataset.n),
      )
      if (rows.includes(U.open)) LIST.at = { n: U.open, rows }
    }
  })
  useEffect(() => {
    const list = ref.current
    if (!list) return
    els.list = list
    const onScroll = () => {
      top.current = list.scrollTop
    }
    const down = (e: PointerEvent) => {
      // only a mouse drags a row (a finger scrolls and swipes)
      const a = (e.target as Element).closest<HTMLElement>('#list article[data-n]')
      if (a)
        a.draggable =
          desk() &&
          e.pointerType === 'mouse' &&
          !(e.target as Element).closest('button, a, input, textarea, [data-act="fold"]')
    }
    const start = (e: DragEvent) => {
      const a = (e.target as Element).closest?.<HTMLElement>('#list article[data-n]'),
        it = a && byN.get(Number(a.dataset.n))
      if (!a || !it || it.type === 'rule' || CLOSED(it.status)) {
        e.preventDefault()
        return
      }
      DRAG.n = it.n
      a.dataset.dragging = ''
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', code(it.n))
      }
    }
    const over = (e: DragEvent) => {
      if (!DRAG.n) return
      const at = dropAt(e)
      if (at) {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      }
      dropMark(at)
    }
    const drop = (e: DragEvent) => {
      if (!DRAG.n) return
      e.preventDefault()
      const n = DRAG.n,
        at = dropAt(e)
      dropMark(null)
      if (at) dragMove(n, at)
    }
    const end = () => {
      dropMark(null)
      list.querySelector('[data-dragging]')?.removeAttribute('data-dragging')
      DRAG.n = 0
    }
    const opts = { passive: true }
    list.addEventListener('scroll', onScroll, opts)
    list.addEventListener('pointerdown', down)
    list.addEventListener('dragstart', start)
    list.addEventListener('dragover', over)
    list.addEventListener('drop', drop)
    list.addEventListener('dragend', end)
    list.addEventListener('pointerenter', listEnter)
    list.addEventListener('pointerleave', listLeave)
    list.addEventListener('touchstart', swipeStart, opts)
    list.addEventListener('touchmove', swipeMove, { passive: false }) // not passive: a sideways swipe keeps the list still
    list.addEventListener('touchend', swipeEnd)
    list.addEventListener('touchcancel', swipeCancel)
    return () => {
      list.removeEventListener('scroll', onScroll)
      list.removeEventListener('pointerdown', down)
      list.removeEventListener('dragstart', start)
      list.removeEventListener('dragover', over)
      list.removeEventListener('drop', drop)
      list.removeEventListener('dragend', end)
      list.removeEventListener('pointerenter', listEnter)
      list.removeEventListener('pointerleave', listLeave)
      list.removeEventListener('touchstart', swipeStart)
      list.removeEventListener('touchmove', swipeMove)
      list.removeEventListener('touchend', swipeEnd)
      list.removeEventListener('touchcancel', swipeCancel)
    }
  }, [])
  const S = model.S
  return (
    <div
      id="list"
      ref={ref}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 data-drop-out:bg-blue-50/60 max-lg:-mb-(--foot-h) max-lg:pb-[calc(var(--foot-h,0px)+1.5rem)] lg:scrollbar-thin lg:scrollbar-gutter-stable lg:hover:scrollbar-thumb-zinc-500/80 dark:data-drop-out:bg-blue-400/5 dark:lg:hover:scrollbar-thumb-zinc-400/70"
    >
      {S.rev < 0 ? (
        <div className="px-6 py-16 text-center text-sm text-zinc-400">Loading…</div>
      ) : (
        <>
          {U.sel.size && desk() ? <SelBar /> : null}
          {body}
          {shown ? <ListMore shown={shown} /> : null}
        </>
      )}
    </div>
  )
}
function ListMore({ shown }: { shown: number }) {
  if (!searchWords().length) return null
  return (
    <div className="flex flex-col py-4">
      <SearchHints shown={shown} />
    </div>
  )
}
