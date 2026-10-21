// Every sheet (one at a time): a handle, a title row (or a head), optional extra buttons beside x, an optional sub
// line and a fixed foot. The focus card floats above the input box instead; a `pop` is a menu at a spot on the
// desktop. lib/dialog.ts says which is open (OV.spec); this draws it.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  ACT_ICON,
  FIELD,
  FOCUS_TONE,
  FWD_NEED,
  NEED,
  PRIMARY,
  PRI_TEXT,
  RULE_STATUS,
  SEG_ON,
  STATE_ON,
  STATUS,
  STATUS_FILTER,
  ARCH_FILTER,
  SORTS,
  STAT_BTN,
  TYPES,
  TYPE_TEXT,
  WHEN,
} from '../lib/constants'
import { STATE_ICON } from '../lib/icons'
import {
  CLOSED,
  DR,
  OV,
  U,
  bump,
  byN,
  byR,
  code,
  dcFind,
  desk,
  detailShown,
  docById,
  filesOf,
  filtered,
  hay,
  inQueue,
  isAudio,
  kids,
  model,
  needsYou,
  oneLine,
  otherProjects,
  plural,
  projOrder,
  rcode,
  statusName,
  titleOf,
  useArea,
  visible,
  when,
  whoName,
  D,
  els,
  openCount,
} from '../lib/state'
import { openItem } from '../lib/nav'
import { P_CACHE } from '../lib/settings'
import type { Item } from '../lib/types'
import { closeDialog } from '../lib/dialog'
import { goAllAhead } from '../lib/go'
import { checkOthers } from '../lib/data'
import { inlineMd, clean } from '../lib/markdown'
import { deskSlots, swipeLeft, swipeRight } from '../lib/rows'
import { CP_ITEM, CP_PAGE, KEYS, paletteRun } from '../lib/keys'
import { noteText } from '../lib/docs'
import { kept } from '../lib/drafts'
import { Armed, Cnt, Icon, ProjTile, StateIcon } from './ui'
import { VW_STATE } from '../lib/views'
import { FileRows, Rich, Talk, Thumbs } from './Talk'
import { NeedsCard, cardMsg, LetterOf } from './Detail'
import { DocEdit, DocView } from './Doc'
import { canUndoInput, deleteTip, filingTip, inputMenuRows } from './Inputs'
import { footRoom, parkBox } from './Composer'

interface Parts {
  title?: string
  head?: ReactNode
  extra?: ReactNode
  sub?: ReactNode
  foot?: ReactNode
  body: ReactNode
}
type Props = Record<string, unknown>

// ---------------------------------------------------------------- small parts
const SegCtl = ({
  act,
  k,
  opts,
  on,
  small = false,
  n,
}: {
  act: string
  k: string
  opts: [string, ReactNode][]
  on: string
  small?: boolean
  n?: number
}) => (
  <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
    {opts.map(([v, t]) => (
      <button
        key={v}
        data-act={act}
        {...(n != null ? { 'data-f': k, 'data-n': n } : { 'data-k': k })}
        data-v={v}
        aria-pressed={v === on}
        className={`relative flex ${small ? 'h-7' : 'h-9'} min-w-0 flex-1 items-center justify-center gap-1 rounded-lg text-[13px] font-medium text-zinc-600 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100 ${SEG_ON}`}
      >
        {t}
      </button>
    ))}
  </div>
)
const typeOpts = (withRule: boolean): [string, ReactNode][] => [
  ...(withRule ? [] : [['all', 'All'] as [string, ReactNode]]),
  ...[...TYPES, ...(withRule ? ['rule'] : [])].map(
    (t) =>
      [
        t,
        <>
          <LetterOf t={t} />
          <span className="truncate">{t[0].toUpperCase() + t.slice(1)}</span>
        </>,
      ] as [string, ReactNode],
  ),
]
const P0 = <span className="font-semibold text-red-600 dark:text-red-400">P0</span>
const priOpts = (withAll: boolean): [string, ReactNode][] => [
  ...(withAll ? [['all', 'Any'] as [string, ReactNode]] : []),
  ['P0', P0],
  ['P1', 'P1'],
  ['P2', 'P2'],
  ['P3', 'P3'],
]
// a status button in the ... menu: the one the item has is aria-pressed, and its fill and icon follow that (T160)
const StatIcon = ({ s, t, size }: { s: string; t: string; size: string }) => (
  <StateIcon
    s={s}
    label={t}
    cls={size}
    tone={
      STATE_ICON[s][1] +
      ' ' +
      STATE_ON[s as 'open']
        .split(' ')
        .map((c) => c.replace(/^(dark:)?/, '$1group-aria-pressed:'))
        .join(' ')
    }
  />
)
const statusesOf = (it: Item) =>
  it.type === 'rule'
    ? Object.entries(RULE_STATUS).filter(([v]) => v !== 'proposed' || it.status === 'proposed')
    : Object.entries(STATUS)
const ItemHeadLine = ({ it, cls = 'text-[15px]' }: { it: Item; cls?: string }) => (
  <span className={`block truncate ${cls} font-semibold`}>
    <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>{code(it.n)}</span>
    {it.title}
  </span>
)

// ---------------------------------------------------------------- the focus card (T65, B153)
function cardSlots(it: Item): ([string, string, string] | null)[] {
  const r = swipeRight(it)
  const fwd = r ? ([r[0], r[1], r[2]] as [string, string, string]) : null
  if (it.archived) return [['archived', 'false', 'Unarchive'], null, null, null]
  if (it.type === 'rule') return [fwd, null, swipeLeft(it)[0] || null, null] // B158
  const [, prog, drop, later] = deskSlots({ ...it, wait: null }, false)
  return [fwd, prog, drop, later]
}
function peekParts({ n }: Props): Parts | null {
  const it = byN.get(n as number)
  if (!it) return null
  const g = U.go && U.go.list.includes(it.n) ? U.go : null,
    files = filesOf(it),
    i = g ? g.list.indexOf(it.n) : -1
  const pin = !it.wait ? cardMsg(it) : null,
    recent = it.thread.filter((x) => x.id !== it.wait?.id && x.id !== pin?.id).slice(-3),
    talk = it.thread.length
  const btn = (attrs: Record<string, string | number>, icon: string, label: string, tone: string, key: string) => (
    <button
      key={key}
      {...attrs}
      className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 ${tone}`}
    >
      <Icon n={icon} c="size-5" />
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
  const slot = (a: [string, string, string], k: number) =>
    btn(
      {
        ...(k ? {} : { 'data-slot': 'fwd' }),
        'data-n': it.n,
        ...(a[0] === 'need'
          ? { 'data-act': 'card-answer' }
          : a[0] === 'reopen'
            ? { 'data-act': 'reopen' }
            : { 'data-act': 'peek-set', 'data-f': a[0], 'data-v': a[1] }),
      },
      ACT_ICON[a[2]],
      a[2],
      FWD_NEED[a[2]] ? NEED[FWD_NEED[a[2]]].text : FOCUS_TONE[a[2]] || 'text-zinc-700 dark:text-zinc-200',
      a[2],
    )
  const last = g && !g.list.slice(i + 1).some((k) => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k) as Item))
  const nav = g ? (
    <div className="flex items-center gap-1 px-2 pt-1">
      <button
        data-act="go-prev"
        disabled={i <= 0}
        className="flex h-11 items-center gap-0.5 rounded-full pr-3 pl-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <Icon n="left" c="size-4" sw="2.25" />
        Previous
      </button>
      <span className="min-w-0 flex-1" />
      <button
        data-act="go-next"
        className="flex h-11 items-center gap-0.5 rounded-full pr-1.5 pl-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {last ? (
          goAllAhead() ? (
            <>
              Next project
              <Icon n="right" c="size-4" sw="2.25" />
            </>
          ) : (
            'End'
          )
        ) : (
          <>
            Next
            <Icon n="right" c="size-4" sw="2.25" />
          </>
        )}
      </button>
    </div>
  ) : null
  // B158: the item's code and Open sit in the header row beside x; a walk's "Needs you · 2 of 5" goes there instead
  const idRow = (
    <div className="flex items-center gap-2">
      <StateIcon s={it.status} label={statusName(it)} cls="size-5" />
      <span className={`font-mono text-sm font-bold ${TYPE_TEXT[it.type]}`}>{code(it.n)}</span>
      <button
        data-act="goto"
        data-n={it.n}
        className="-my-2 ml-auto flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10"
      >
        <Icon n="open" c="size-4" />
        Open
      </button>
    </div>
  )
  return {
    head: g ? (
      <span className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-wide whitespace-nowrap text-amber-700 uppercase dark:text-amber-400">
          Needs you
        </span>
        <span className="text-xs font-medium whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
          {i + 1} of {g.list.length}
        </span>
      </span>
    ) : (
      idRow
    ),
    sub: g ? (
      <div className="flex gap-1 px-4 pb-1" aria-hidden="true">
        {g.list.map((k) => (
          <span
            key={k}
            className={`h-1 flex-1 rounded-full ${k === it.n ? 'bg-amber-500 dark:bg-amber-400' : g.done.has(k) ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          />
        ))}
      </div>
    ) : null,
    foot: (
      <div className="border-t border-zinc-100 dark:border-zinc-800">
        {nav}
        <div className="flex gap-1 px-2 py-1">
          {cardSlots(it).map((a, k) => (a ? slot(a, k) : null))}
          {btn({ 'data-act': 'card-copy', 'data-n': it.n }, 'copy', 'Copy', 'text-zinc-700 dark:text-zinc-200', 'copy')}
        </div>
      </div>
    ),
    body: (
      <div className="pb-1">
        {g ? idRow : null}
        <h2 className={`${g ? 'mt-1' : ''} text-[19px] leading-snug font-semibold break-words`}>{it.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {it.type === 'rule' ? null : <span className={PRI_TEXT[it.pri]}>{it.pri}</span>}
          <span>{statusName(it)}</span>
          <span>{WHEN[it.when]}</span>
          <span>{it.type[0].toUpperCase() + it.type.slice(1)}</span>
          {talk ? <Cnt icon="comment" n={talk} label={plural(talk, 'comment')} /> : null}
        </div>
        {it.wait ? (
          <div data-need className="mt-4 scroll-mt-2">
            <NeedsCard it={it} onCard />
          </div>
        ) : pin ? (
          <div data-need className="mt-4 flex flex-col gap-4">
            <Talk it={it} list={[pin]} gid="p" />
          </div>
        ) : null}
        {it.body ? (
          <Rich text={it.body} gid={'pbody' + it.n} cls="mt-4 text-[15px] text-zinc-700 dark:text-zinc-300" />
        ) : null}
        {it.next ? (
          <div className="mt-2 flex gap-2 text-sm">
            <span className="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Next</span>
            <span className="min-w-0 break-words" dangerouslySetInnerHTML={{ __html: clean(inlineMd(it.next)) }} />
          </div>
        ) : null}
        {files.length ? <FileRows files={files} gid={'peek' + it.n} cls="mt-3" /> : null}
        {recent.length ? (
          <div className="mt-4 flex flex-col gap-4">
            <Talk it={it} list={recent} gid="p" />
          </div>
        ) : null}
      </div>
    ),
  }
}

// ---------------------------------------------------------------- the ... menu (T65, T113 A16)
function menuParts({ n, arm }: Props): Parts | null {
  const it = byN.get(n as number)
  if (!it) return null
  const tile = (
    act: string,
    icon: string,
    label: string,
    sub = '',
    attrs: Record<string, string> = {},
    inner?: ReactNode,
  ) => (
    <button
      key={act + label}
      data-act={act}
      data-n={it.n}
      {...attrs}
      className="flex h-19 flex-col items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 px-1 text-[13px] leading-tight font-medium text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      <Icon n={icon} c="size-5.5 text-zinc-600 dark:text-zinc-300" />
      <span className="text-center">
        {inner ?? label}
        {sub ? <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">{sub}</span> : null}
      </span>
    </button>
  )
  const next =
    inQueue(it) && it.when === 'now'
      ? tile(
          'do-next',
          'up',
          it.rank == null ? 'Do this next' : 'Back in order',
          it.rank == null ? `first of the ${it.pri}s` : '',
        )
      : null // F197
  const state = it.archived
    ? [tile('archive', 'archive', 'Unarchive', '', { 'data-on': '0' })]
    : CLOSED(it.status)
      ? [tile('archive', 'archive', 'Archive', '', { 'data-on': '1' })]
      : [
          it.type === 'rule'
            ? null
            : tile('swipe', 'clock', it.when === 'now' ? 'Later' : 'Back to now', '', {
                'data-f': 'when',
                'data-v': it.when === 'now' ? 'later' : 'now',
              }),
          tile('archive', 'archive', 'Archive', '', { 'data-on': '1' }),
        ] // F281: any state
  const lab = (t: string) => <div className="px-1 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t}</div>
  const statuses = statusesOf(it)
  const type = (
    <div>
      {lab('Type')}
      <SegCtl act="set-field" k="type" n={it.n} opts={typeOpts(true)} on={it.type} />
    </div>
  )
  const pri =
    it.type === 'rule' ? null : (
      <div>
        {lab('Priority')}
        <SegCtl act="set-field" k="pri" n={it.n} opts={priOpts(false)} on={it.pri} />
      </div>
    )
  const status = (
    <div>
      {lab('Status')}
      <div className="grid grid-cols-3 gap-1.5">
        {statuses.map(([s, t]) => (
          <button
            key={s}
            data-act="set-field"
            data-n={it.n}
            data-f="status"
            data-v={s}
            aria-pressed={it.status === s}
            className={`${STAT_BTN} h-11 rounded-xl px-2.5`}
          >
            <StatIcon s={s} t={t} size="size-4.5" />
            <span className="truncate">{t}</span>
          </button>
        ))}
      </div>
    </div>
  )
  const head = <ItemHeadLine it={it} />
  const only = ({ s: status, p: pri, t: type } as Record<string, ReactNode>)[(arm as string) || '']
  if (only) return { head, body: only } // B302: a property's chip picks that property, as on the desktop
  return {
    head,
    body: (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2">
          {tile('edit', 'pencil', 'Edit')}
          {tile('copy', 'copy', 'Copy for agent')}
          {tile('doc-new', 'docplus', 'New doc')}
          {tile('sub-new', 'listplus', 'Add subitem')}
          {tile('reparent', 'indent', 'Put under…', it.parent ? `now under ${code(it.parent)}` : '')}
          {state}
          {next}
          {tile('item-move-proj', 'arrow', 'Move to project…')}
          {tile(
            'item-delete',
            'trash',
            'Delete',
            '',
            {},
            <Armed k={'item-delete ' + it.n} ask={`Delete ${code(it.n)}?`}>
              Delete
            </Armed>,
          )}
        </div>
        {type}
        {pri}
        {status}
      </div>
    ),
  }
}
function menuDeskParts({ n }: Props): Parts | null {
  const it = byN.get(n as number)
  if (!it) return null
  const arm = U.menuArm
  const row = (
    act: string,
    icon: string,
    label: ReactNode,
    key: string,
    attrs: Record<string, string> = {},
    sub = '',
  ) => (
    <button
      key={act + String(attrs['data-on'] ?? '') + String(attrs['data-v'] ?? '')}
      data-act={act}
      data-n={it.n}
      {...attrs}
      className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <Icon n={icon} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">
        {label}
        {sub ? <span className="ml-2 text-xs text-zinc-400">{sub}</span> : null}
      </span>
      {key ? (
        <kbd className="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600">
          {key}
        </kbd>
      ) : null}
    </button>
  )
  const lab = (t: string, keys: string, on: boolean) => (
    <div
      className={`flex items-center justify-between px-1 pb-1.5 text-xs font-semibold ${on ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}
    >
      {t}
      <span className={`font-normal ${on ? '' : 'text-zinc-400'}`}>{keys}</span>
    </div>
  )
  const statuses = statusesOf(it)
  const next =
    inQueue(it) && it.when === 'now'
      ? row(
          'do-next',
          'up',
          it.rank == null ? 'Do this next' : 'Back in order',
          '',
          {},
          it.rank == null ? `first of the ${it.pri}s in the queue` : 'where it was, by age',
        )
      : null // F197
  const state = it.archived
    ? [row('archive', 'archive', 'Unarchive', 'E', { 'data-on': '0' })]
    : CLOSED(it.status)
      ? [row('archive', 'archive', 'Archive', 'E', { 'data-on': '1' })]
      : [
          it.type === 'rule'
            ? null
            : row('swipe', 'clock', it.when === 'now' ? 'Later' : 'Back to now', 'L', {
                'data-f': 'when',
                'data-v': it.when === 'now' ? 'later' : 'now',
              }),
          row('archive', 'archive', 'Archive', 'E', { 'data-on': '1' }),
        ] // F281
  return {
    head: <ItemHeadLine it={it} cls="text-sm" />,
    body: (
      <div className="flex flex-col gap-3">
        <div className="-mx-1">
          {row('edit', 'pencil', 'Edit', 'I')}
          {row('copy', 'copy', 'Copy for agent', '⇧C')}
          {it.type === 'rule' ? null : (
            <>
              {row('doc-new', 'docplus', 'New doc', '⇧D')}
              {row('sub-new', 'listplus', 'Add subitem', '⇧A')}
              {row(
                'reparent',
                'indent',
                'Put under…',
                'M',
                {},
                it.parent ? 'now under ' + code(it.parent) : 'stands on its own',
              )}
            </>
          )}
          {state}
          {next}
          {row('item-move-proj', 'arrow', 'Move to project…', '')}
          {row(
            'item-delete',
            'trash',
            <Armed k={'item-delete ' + it.n} ask={`Delete ${code(it.n)}?`}>
              Delete
            </Armed>,
            '',
          )}
        </div>
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {lab('Type', 'T then F B I T R', arm === 't')}
          <SegCtl act="set-field" k="type" n={it.n} opts={typeOpts(true)} on={it.type} small />
        </div>
        {it.type === 'rule' ? null : (
          <div>
            {lab('Priority', 'P then 0–3', arm === 'p')}
            <SegCtl act="set-field" k="pri" n={it.n} opts={priOpts(false)} on={it.pri} small />
          </div>
        )}
        <div>
          {lab('Status', `S then 1–${statuses.length}`, arm === 's')}
          <div className="grid grid-cols-3 gap-1">
            {statuses.map(([v, t], i) => (
              <button
                key={v}
                data-act="set-field"
                data-n={it.n}
                data-f="status"
                data-v={v}
                aria-pressed={it.status === v}
                className={`${STAT_BTN} h-8 rounded-lg px-2`}
              >
                <StatIcon s={v} t={t} size="size-4" />
                <span className="truncate">{t}</span>
                {arm === 's' ? (
                  <span className="ml-auto pl-1 font-mono text-[11px] text-zinc-400 group-aria-pressed:text-white/70 dark:group-aria-pressed:text-zinc-900/60">
                    {i + 1}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
  }
}
// the keys stay in the menu (B8): after a redraw the focus goes back where it was, or to the armed part
function useMenuFocus(kind: string | undefined, body: HTMLElement | null) {
  useLayoutEffect(() => {
    if (kind !== 'menu-desk' || !body) return
    const a = document.activeElement as HTMLElement | null
    if (a && body.contains(a)) return
    const f = ({ t: 'type', p: 'pri', s: 'status' } as Record<string, string>)[U.menuArm || '']
    ;(
      (f &&
        (body.querySelector<HTMLElement>(`[data-f="${f}"][aria-pressed="true"]`) ||
          body.querySelector<HTMLElement>(`[data-f="${f}"]`))) ||
      body.querySelector<HTMLElement>('button')
    )?.focus({ preventScroll: true })
  })
}

// ---------------------------------------------------------------- filters (T65): segmented controls and pills
export function FilterControls({ small = false }: { small?: boolean }) {
  const lab = (t: string) => (
    <div
      className={`px-1 ${small ? 'pb-1 text-[11px]' : 'pb-2 text-xs'} font-semibold text-zinc-500 dark:text-zinc-400`}
    >
      {t}
    </div>
  )
  const statuses = [
    ['all', 'All'],
    ...Object.entries(U.tab === 'rules' ? RULE_STATUS : U.tab === 'archive' ? ARCH_FILTER : STATUS_FILTER),
  ]
  return (
    <>
      {U.tab === 'rules' ? null : (
        <div>
          {lab('Type')}
          <SegCtl act="set-filter" k="type" opts={typeOpts(false)} on={U.type} small={small} />
        </div>
      )}
      {U.tab === 'archive' ? (
        <div>
          {lab('When')}
          <SegCtl
            act="set-filter"
            k="when"
            opts={[
              ['all', 'Any time'],
              ['now', 'Now'],
              ['later', 'Later'],
            ]}
            on={U.when}
            small={small}
          />
        </div>
      ) : null}
      <div>
        {lab('Status')}
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(([v, t]) => (
            <button
              key={v}
              data-act="set-filter"
              data-k="status"
              data-v={v}
              aria-pressed={U.status === v}
              className={`relative ${small ? 'h-7 px-2.5' : 'h-9 px-3.5'} rounded-full bg-zinc-100 text-[13px] font-medium text-zinc-700 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {U.tab === 'rules' ? null : (
        <div>
          {lab('Priority')}
          <SegCtl act="set-filter" k="pri" opts={priOpts(true)} on={U.pri} small={small} />
        </div>
      )}
      <div>
        {lab('Sort')}
        <SegCtl act="set-filter" k="sort" opts={SORTS} on={U.sort} small={small} />
      </div>
      {U.tab === 'items' ? (
        // F320: these filters, kept as one of your views (in the view row, in every project)
        <div>
          {lab('Save as a view')}
          <div className="flex items-center gap-1.5">
            <input
              id="viewName"
              placeholder="Name"
              aria-label="Name of the view"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.currentTarget.nextElementSibling as HTMLElement | null)?.click()
              }}
              className={`${FIELD} h-9 min-w-0 flex-1 py-1.5 text-sm`}
            />
            <button
              data-act="view-save"
              className="h-9 shrink-0 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
function filtersParts(): Parts {
  const rows = visible(),
    n = rows.length,
    open = rows.filter((it) => !CLOSED(it.status) && !it.archived).length // B158, B130
  return {
    title: 'Filter',
    extra: filtered() ? (
      <button
        data-act="reset"
        className="h-11 rounded-full px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10"
      >
        Clear all
      </button>
    ) : null,
    body: (
      <div className="flex flex-col gap-5">
        <FilterControls />
        <button data-act="close" className={`${PRIMARY} w-full`}>
          Show{' '}
          {U.tab === 'items' && open !== n
            ? `${open} open, ${n - open} finished`
            : plural(n, U.tab === 'rules' ? 'rule' : 'item')}
        </button>
      </div>
    ),
  }
}

// ---------------------------------------------------------------- keys, switch project, palette
function keysParts(): Parts {
  const sec = ([group, keys]: (typeof KEYS)[number]) => (
    <section key={group} className="mb-5">
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{group}</h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        {keys.map(([k, what]) => (
          <div key={k} className="flex items-baseline gap-3">
            <dt className="w-28 shrink-0 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-200">{k}</dt>
            <dd className="text-zinc-600 dark:text-zinc-300">{what}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
  return {
    title: 'Keyboard shortcuts',
    body: (
      <div className="grid gap-x-8 sm:grid-cols-2">
        <div>
          {sec(KEYS[0])}
          {sec(KEYS[3])}
        </div>
        <div>
          {sec(KEYS[1])}
          {sec(KEYS[2])}
        </div>
      </div>
    ),
  }
}
// G P: pick another project by typing (B126). Up and down choose, Enter opens, Esc closes.
function Switcher() {
  const [q, setQ] = useState('')
  const [i, setI] = useState(-1)
  const list = useRef<HTMLDivElement>(null)
  useArea('side')
  useLayoutEffect(() => {
    checkOthers(true).then(() => bump('side'))
  }, [])
  const S = model.S
  const rows = (DR.list || [])
    .filter((p) => (titleOf(p) + ' ' + p.name).toLowerCase().includes(q.trim().toLowerCase()))
    .sort(projOrder)
  const at =
    i < 0 || i >= rows.length
      ? Math.max(
          0,
          rows.findIndex((p) => p.name !== S.project),
        )
      : i
  useLayoutEffect(() => {
    // braces: scrollIntoView may return a promise, and an effect may return only a clean-up
    list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  })
  return (
    <>
      <input
        id="projFilter"
        autoFocus
        className={FIELD}
        placeholder="Type to find a project"
        aria-label="Find a project"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setI(-1)
        }}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
            e.preventDefault()
            setI((at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
          } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            list.current?.querySelectorAll<HTMLElement>('a[data-i]')[at]?.click()
          }
        }}
      />
      <div id="projList" ref={list} className="-mx-1 mt-2 flex flex-col gap-0.5">
        {rows.length ? (
          rows.map((p, k) => (
            <a
              key={p.name}
              href={`/p/${encodeURIComponent(p.name)}/`}
              data-i={k}
              aria-selected={k === at}
              className="flex h-11 items-center gap-3 rounded-xl px-3 hover:bg-zinc-100 aria-selected:bg-zinc-100 aria-selected:ring-1 aria-selected:ring-zinc-300 dark:hover:bg-zinc-800 dark:aria-selected:bg-zinc-800 dark:aria-selected:ring-zinc-600"
            >
              <ProjTile name={p.name} cls="size-6 rounded-md text-xs" />
              <span className={`min-w-0 flex-1 truncate ${p.name === S.project ? 'font-semibold' : ''}`}>
                {titleOf(p)}
              </span>
              {p.name === S.project ? <span className="text-xs text-zinc-400">this one</span> : null}
              {p.needs ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
                  {p.needs} need you
                </span>
              ) : null}
            </a>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-zinc-500">{DR.list ? 'No project matches' : 'Loading…'}</p>
        )}
      </div>
    </>
  )
}
// T274 #33: Cmd-K, one place to find an item or do anything the keys do; a command replays its keys.
function Palette() {
  const [q0, setQ] = useState('')
  const [i, setI] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const q = q0.trim().toLowerCase(),
    n = detailShown() && !D.compose ? U.open : null,
    has = (t: string) => !q || t.toLowerCase().includes(q)
  const items = q
    ? model.S.items
        .filter((it) => !it.merged_into && hay(it).includes(q))
        .sort((a, b) => Number(CLOSED(a.status)) - Number(CLOSED(b.status)) || b.n - a.n)
        .slice(0, 6)
    : []
  const rows: { t: string; sub?: string; k?: string; n?: number }[] = [
    ...(n ? CP_ITEM.filter(([t]) => has(t) || has(code(n))).map(([t, k]) => ({ t, sub: code(n), k })) : []),
    ...CP_PAGE.filter(([t]) => has(t)).map(([t, k]) => ({ t, k })),
    ...items.map((it) => ({ t: it.title, n: it.n })),
  ]
  const at = Math.min(i, Math.max(0, rows.length - 1))
  useLayoutEffect(() => {
    // braces: scrollIntoView may return a promise, and an effect may return only a clean-up
    list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  })
  const run = (r: (typeof rows)[number] | undefined) => {
    if (!r) return
    if (r.n) {
      closeDialog()
      return openItem(r.n)
    }
    paletteRun(r.k || '')
  }
  return (
    <>
      <input
        id="cpFilter"
        autoFocus
        className={FIELD}
        placeholder="Type a command, a code or words of an item"
        aria-label="Command or item"
        autoComplete="off"
        value={q0}
        onChange={(e) => {
          setQ(e.target.value)
          setI(0)
        }}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
            e.preventDefault()
            setI((at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
          } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            run(rows[at])
          }
        }}
      />
      <div id="cpList" ref={list} className="-mx-1 mt-2 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
        {rows.length ? (
          rows.map((r, k) => {
            const it = r.n ? byN.get(r.n) : undefined
            return (
              <button
                key={k}
                data-act="cp-run"
                data-i={k}
                {...(r.n ? { 'data-n': r.n } : { 'data-k': r.k })}
                aria-selected={k === at}
                className="flex h-10 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 aria-selected:bg-zinc-100 dark:hover:bg-zinc-800 dark:aria-selected:bg-zinc-800"
              >
                {it ? (
                  <>
                    <StateIcon s={it.status} label={statusName(it)} cls="size-4" />
                    <span className={`font-mono text-xs font-bold ${TYPE_TEXT[it.type]}`}>{code(it.n)}</span>
                    <span className="min-w-0 flex-1 truncate">{r.t}</span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate">
                      {r.t}
                      {r.sub ? (
                        <span className="ml-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">{r.sub}</span>
                      ) : null}
                    </span>
                    {(r.k || '').split(' ').map((x, j) => (
                      <kbd
                        key={j}
                        className="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-600"
                      >
                        {x}
                      </kbd>
                    ))}
                  </>
                )}
              </button>
            )
          })
        ) : (
          <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Nothing matches</p>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- pick an item (T257), put under (B156)
function Picker({
  placeholder,
  act,
  data,
  skip,
  sort,
  extra,
  current,
}: {
  placeholder: string
  act: string
  data: Props
  skip: Set<number>
  sort: (a: Item, b: Item) => number
  extra?: ReactNode
  current?: number | null
}) {
  const [q, setQ] = useState('')
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const cands = model.S.items
    .filter(
      (c) =>
        !skip.has(c.n) && !c.merged_into && !c.archived && c.type !== 'rule' && words.every((w) => hay(c).includes(w)),
    )
    .sort(sort)
    .slice(0, 40)
  const attrs = Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, String(v)]))
  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus={desk()}
        className={`${FIELD} lg:h-9 lg:py-0 lg:text-sm`}
        placeholder={placeholder}
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="-mx-1 max-h-[55dvh] overflow-y-auto lg:max-h-80 lg:scrollbar-thin">
        {cands.length || extra ? (
          cands.map((c) => (
            <button
              key={c.n}
              data-act={act}
              {...attrs}
              data-to={code(c.n)}
              {...(current === c.n ? { 'aria-current': 'true' as const } : {})}
              className="flex h-12 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] hover:bg-zinc-100 aria-[current=true]:bg-blue-50 lg:h-9 lg:text-sm dark:hover:bg-zinc-800 dark:aria-[current=true]:bg-blue-400/10"
            >
              <StateIcon s={c.status} label={statusName(c)} cls="size-4" />
              <span className={`font-mono text-xs font-bold ${TYPE_TEXT[c.type]}`}>{code(c.n)}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
            </button>
          ))
        ) : (
          <p className="px-2.5 py-2 text-sm text-zinc-500 dark:text-zinc-400">Nothing matches</p>
        )}
        {extra}
      </div>
    </div>
  )
}
const closedLast = (a: Item, b: Item) => Number(CLOSED(a.status)) - Number(CLOSED(b.status))
function moveParts({ n }: Props): Parts | null {
  const it = byN.get(n as number)
  if (!it) return null
  const below = new Set([it.n])
  const walk = (k: number) => {
    for (const c of kids.get(k) || [])
      if (!below.has(c.n)) {
        below.add(c.n)
        walk(c.n)
      }
  }
  walk(it.n)
  return {
    head: <span className="text-[15px] font-semibold lg:text-sm">Move {code(it.n)} under…</span>,
    body: (
      <Picker
        placeholder={`Put ${code(it.n)} under…`}
        act="move-to"
        data={{ n: it.n }}
        skip={below}
        sort={(a, b) => closedLast(a, b) || a.n - b.n}
        current={it.parent}
        extra={
          <button
            data-act="move-to"
            data-n={it.n}
            data-to="none"
            className="mt-1 flex h-12 w-full items-center gap-2.5 rounded-lg border-t border-zinc-100 px-2.5 text-left text-[15px] hover:bg-zinc-100 lg:h-9 lg:text-sm dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            <Icon n={it.parent ? 'x' : 'check'} c="size-4 text-zinc-500" />
            Stands on its own
          </button>
        }
      />
    ),
  }
}
function pickParts({ head, act, data, skip }: Props): Parts {
  return {
    head: <span className="text-[15px] font-semibold lg:text-sm">{head as string}</span>,
    body: (
      <Picker
        placeholder="Find an item"
        act={act as string}
        data={data as Props}
        skip={new Set((skip as number[]) || [])}
        sort={(a, b) => closedLast(a, b) || b.n - a.n}
      />
    ),
  }
}

// ---------------------------------------------------------------- a project's menu (F173)
function projMenuParts({ slug }: Props): Parts | null {
  const S = model.S,
    s = slug as string,
    here = s === S.project
  const p = here ? { name: S.project, title: S.title, open: openCount() } : (DR.list || []).find((p) => p.name === s)
  if (!p) return null
  const row = (act: string, icon: string, label: string, key = '') => (
    <button
      key={act}
      data-act={act}
      data-slug={s}
      className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <Icon n={icon} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {key ? (
        <kbd className="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600">
          {key}
        </kbd>
      ) : null}
    </button>
  )
  return {
    // B356: opened from the project's own name above it, the menu does not say that name again
    head: here ? undefined : (
      <span className="flex items-center gap-2.5">
        <ProjTile name={s} cls="size-8 rounded-lg text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{titleOf(p)}</span>
          <span className="block truncate font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">
            /p/{s} · {p.open} open
          </span>
        </span>
      </span>
    ),
    body: (
      <div className="-mx-1 flex flex-col">
        {here ? null : row('proj-open', 'arrow', 'Open')}
        {row(here ? 'project' : 'proj-settings', 'gear', 'Project settings', here ? 'G S' : '')}
        {here ? row('switch', 'updown', 'Switch project', 'G P') : null}
        {(DR.list || []).length > 1 ? (
          <>
            {row('proj-up', 'chevup', 'Move up')}
            {row('proj-down', 'down', 'Move down')}
          </>
        ) : null}
        {row('proj-new', 'plus', 'New project')}
        <div className="my-1.5 border-t border-zinc-100 dark:border-zinc-800" />
        {row('proj-manage', 'pencil', 'Rename or delete…')}
      </div>
    ),
  }
}

// ---------------------------------------------------------------- an input's ... and its other sheets
function inputMenuParts({ id }: Props): Parts | null {
  const r = byR.get(id as string)
  if (!r) return null
  const ok = inputMenuRows(r)
  const row = (act: string, icon: string, label: string, tip = '') => (
    <button
      key={act}
      data-act="input-pick"
      data-pick={act}
      data-id={r.id}
      {...(tip ? { title: tip } : {})}
      className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <Icon n={icon} c="size-4 text-zinc-500 dark:text-zinc-400" />
      {label}
    </button>
  )
  return {
    title: rcode(r.id),
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        {row('input-edit', 'pencil', 'Edit')}
        {row('input-append', 'plus', 'Add more')}
        {P_CACHE.prefs?.tidy !== false
          ? r.files.filter(isAudio).map((f) => (
              <button
                key={'said' + f.f}
                data-act="as-said"
                data-f={f.f}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Icon n="mic" c="size-4 text-zinc-500 dark:text-zinc-400" />
                Original words
              </button>
            ))
          : null}
        {canUndoInput(r) && ok.undo ? row('undo', 'undo', 'Undo organizing', filingTip(r)) : null}
        {ok.move ? row('move-input', 'arrow', 'Move to…', 'Sent to the wrong project? Move it') : null}
        {ok.history ? row('input-history', 'clock', 'History') : null}
        {row('rescope-pick', 'reply', r.scope ? `Put with another item (now ${code(r.scope)})…` : 'Put with an item…')}
        {r.files.map((f) => (
          <button
            key={f.f}
            data-act="sent-unfile"
            data-id={r.id}
            data-f={f.f}
            className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Icon n="x" c="size-4 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1 truncate">
              <Armed k={`unfile  ${r.id} ${f.f}`} ask="Take it off?">
                Take off {f.name || 'a file'}
              </Armed>
            </span>
          </button>
        ))}
        {row('input-delete', 'trash', 'Delete', deleteTip(r))}
      </div>
    ),
  }
}
function historyParts({ id }: Props): Parts | null {
  const r = byR.get(id as string)
  if (!r) return null
  const h = r.history || []
  const versions = [
    { text: r.text, t: r.updated || r.t, label: 'Current' },
    ...h.map((x, i) => ({ ...x, t: i ? h[i - 1].t : r.t, label: i ? `Version ${i + 1}` : 'Original' })).reverse(),
  ]
  return {
    title: `${rcode(r.id)} history`,
    body: (
      <>
        {versions.map((v, i) => (
          <section key={i} className="mb-5">
            <h3 className="mb-2 text-sm font-semibold">
              {v.label}
              <span className="ml-2 font-normal text-zinc-400">{when(v.t)}</span>
            </h3>
            <p className="text-[15px] break-words whitespace-pre-wrap">{v.text}</p>
          </section>
        ))}
      </>
    ),
  }
}
function sourcesParts({ n }: Props): Parts | null {
  const it = byN.get(n as number)
  if (!it) return null
  const rs = it.srcs.map((id) => byR.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byR.get>>[]
  return {
    title: `What ${code(it.n)} came from`,
    body: (
      <div className="flex flex-col gap-4">
        {rs.length ? (
          rs.map((r) => (
            <div key={r.id}>
              <div className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                <button
                  data-act="go-input"
                  data-id={r.id}
                  className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                >
                  {rcode(r.id)}
                </button>{' '}
                · {when(r.t)} · {whoName(r.by)}
              </div>
              <div className="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed dark:bg-blue-400/10">
                {r.text ? <Rich text={r.text} gid={'src' + r.id} /> : null}
                {r.files.length ? (
                  <div className="mt-2 flex items-end gap-2 overflow-x-auto lg:scrollbar-thin">
                    <Thumbs files={r.files} gid={'src' + r.id} />
                  </div>
                ) : null}
              </div>
              {r.org ? (
                <div className="mt-1.5 flex items-center gap-1 px-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <Icon n="sparkle" c="size-3.5" />
                  {r.org.msg}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No sources.</p>
        )}
      </div>
    ),
  }
}
function MoveInputBody({ id }: { id: string }) {
  useArea('side')
  useLayoutEffect(() => {
    checkOthers(true).then(() => bump('side'))
  }, [])
  const r = byR.get(id)
  if (!r) return null
  const others = otherProjects(),
    made = r.touched.filter((n) => n !== r.scope && byN.has(n) && !byN.get(n)?.archived)
  const byOrg = r.org && r.org.ok && !r.org.undone && !r.org.keep
  const list = made.map((n) => `${code(n)} ${byN.get(n)?.title}`).join(', ')
  return (
    <div className="flex flex-col gap-3">
      <p className="line-clamp-3 rounded-xl bg-blue-50 px-3 py-2 text-[15px] leading-snug break-words text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100">
        {r.text || `${r.files.length} file${r.files.length === 1 ? '' : 's'}`}
      </p>
      <div className="-mx-1 flex flex-col gap-0.5">
        {others.length ? (
          others.map((p) => (
            <button
              key={p.name}
              data-act="move-input-to"
              data-id={id}
              data-to={p.name}
              className="flex h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 data-pressed:bg-zinc-100 dark:hover:bg-zinc-800 dark:data-pressed:bg-zinc-800"
            >
              <ProjTile name={p.name} cls="size-7 rounded-lg text-xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{titleOf(p)}</span>
              <span className="text-xs text-zinc-400">{p.open} open</span>
            </button>
          ))
        ) : (
          <p className="px-3 text-sm text-zinc-500">There is no other project.</p>
        )}
      </div>
      <p className="text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
        It goes there with its files and is organized again.
        {made.length
          ? byOrg
            ? ` What the organizer made of it here is undone: ${list}.`
            : ` Items made from it here stay: ${list}.`
          : ''}
        {r.scope && byN.has(r.scope) ? ` It also leaves the conversation of ${code(r.scope)}.` : ''}
      </p>
    </div>
  )
}
function itemMoveProjParts({ n }: Props): Parts | null {
  const it = byN.get(n as number)
  if (!it) return null
  return {
    title: `Move ${code(it.n)} to another project`,
    body: (
      <>
        <div className="-mx-1 flex flex-col gap-0.5">
          {otherProjects().map((p) => (
            <button
              key={p.name}
              data-act="item-move-to"
              data-n={it.n}
              data-to={p.name}
              className="flex h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 lg:h-10 dark:hover:bg-zinc-800"
            >
              <ProjTile name={p.name} cls="size-7 rounded-lg text-sm" />
              <span className="min-w-0 flex-1 truncate">{titleOf(p)}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
          It is made there with its text and its talk, and its subitems go along under it; here they are marked
          won&apos;t do and archived, with a note where each went.
        </p>
      </>
    ),
  }
}
function dcMoveParts({ d, id }: Props): Parts | null {
  const doc = docById(d as number),
    c = dcFind(d as number, id as number)
  if (!doc || !c) return null
  const opt = (key: string, label: ReactNode) => (
    <button
      key={key}
      data-act="dc-move-to"
      data-d={doc.d}
      data-id={c.id}
      data-key={key}
      {...(key === c.key ? { 'aria-current': 'true' as const } : {})}
      className="flex min-h-11 w-full items-center rounded-lg px-3 py-1.5 text-left text-sm hover:bg-zinc-100 aria-[current=true]:bg-blue-50 dark:hover:bg-zinc-800 dark:aria-[current=true]:bg-blue-400/10"
    >
      <span className="line-clamp-2">{label}</span>
    </button>
  )
  return {
    title: 'Move the comment to…',
    body: (
      <div className="-mx-1 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
        {opt('doc', <b>The whole document</b>)}
        {doc.blocks.map((x) => opt(x.key, oneLine(x.text).slice(0, 120)))}
      </div>
    ),
  }
}
function asSaidParts({ heard, tr }: Props): Parts {
  return {
    title: 'Original words',
    body: (
      <>
        <p className="text-[15px] break-words whitespace-pre-wrap">
          {(heard as string) || (tr as string) || 'No words were heard.'}
        </p>
        {heard ? null : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Nothing was tidied in this one: the words are as said.
          </p>
        )}
      </>
    ),
  }
}
// The phone's document sheet, and the editor (new documents on the desktop too)
function docParts(): Parts | null {
  const d = U.doc ? docById(U.doc) : undefined
  if (!d) return null
  return { title: `D${d.d}`, body: <DocView d={d} /> }
}
function docEditParts(): Parts {
  const d = U.doc ? docById(U.doc) : undefined
  const md = U.docText ?? (d ? noteText(d) : (kept('docs')[`new ${U.docNew}`] as string) || '')
  return {
    title: d ? `D${d.d}` : `New doc on ${code(U.docNew as number)}`,
    body: <DocEdit key={d ? 'e' + d.d : 'n' + U.docNew} d={d} md={md} />,
  }
}

const KINDS: Record<string, (p: Props) => Parts | null> = {
  peek: peekParts,
  menu: menuParts,
  'menu-desk': menuDeskParts,
  filters: filtersParts,
  keys: keysParts,
  switch: () => ({ title: 'Switch project', body: <Switcher /> }),
  palette: () => ({ title: 'Go to or do', body: <Palette /> }),
  move: moveParts,
  pick: pickParts,
  'proj-menu': projMenuParts,
  'input-menu': inputMenuParts,
  'view-menu': ({ i }) => ({
    // F320: one of your views
    title: VW_STATE.list[i as number]?.name || 'View',
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        <button
          data-act="view-rename"
          data-i={i as number}
          className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Icon n="pencil" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Rename
        </button>
        <button
          data-act="view-update"
          data-i={i as number}
          className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Icon n="loop" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Show the filters set now
        </button>
        <button
          data-act="view-delete"
          data-i={i as number}
          className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Icon n="trash" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Delete
        </button>
      </div>
    ),
  }),
  'sign-in': () => ({
    // T339 #16: the key, asked for in the page
    title: 'Taska needs its key',
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          From outside this computer&apos;s network, Taska asks for its key once on each device. It is in the link
          Settings › Use on your phone gives.
        </p>
        <input
          id="signKey"
          type="password"
          autoComplete="current-password"
          placeholder="Key"
          aria-label="Taska's key"
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget.nextElementSibling as HTMLElement | null)?.click()
          }}
          className={FIELD}
        />
        <button data-act="sign-in" className={PRIMARY}>
          Sign in
        </button>
      </div>
    ),
  }),
  'msg-menu': ({ n, id }) => ({
    title: 'Message',
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        <button
          data-act="msg-hide"
          data-n={n as number}
          data-id={id as number}
          data-on={1}
          className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Icon n="shrink" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Hide (folds to one line)
        </button>
      </div>
    ),
  }),
  history: historyParts,
  sources: sourcesParts,
  'move-input': ({ id }) => {
    const r = byR.get(id as string)
    return r ? { title: `Move ${rcode(r.id)} to another project`, body: <MoveInputBody id={r.id} /> } : null
  },
  'item-move-proj': itemMoveProjParts,
  'dc-move': dcMoveParts,
  'as-said': asSaidParts,
  doc: docParts,
  'doc-edit': docEditParts,
}

const CloseX = () => (
  <span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700 dark:group-hover:text-zinc-200">
    <Icon n="x" c="size-4" sw="2.25" />
  </span>
)
// the drag down on the phone's handle closes it; a swipe on the card means what it means on a row (B153)
const DRAG = { id: 0, y0: 0, dy: 0, on: false }
const FC = { x: null as number | null, y: 0, dx: 0, on: false }
export function Dialog() {
  useArea('dialog')
  useArea('detail')
  const dlg = useRef<HTMLElement>(null),
    body = useRef<HTMLDivElement>(null),
    overlay = useRef<HTMLDivElement>(null)
  const spec = OV.spec
  const parts = spec ? KINDS[spec.kind]?.(spec.props) : null
  useMenuFocus(spec?.kind, body.current)
  useLayoutEffect(() => {
    const o = overlay.current,
      d = dlg.current,
      b = body.current
    if (!o || !d || !b) return
    if (!spec) return
    o.style.bottom = spec.aboveComposer ? footRoom() + 'px' : ''
    // B129: a menu opened by right-click sits at the pointer, kept on screen
    const xy = OV.popXY
    if (xy && desk()) {
      o.style.paddingLeft = `${Math.max(8, Math.min(xy[0], innerWidth - d.offsetWidth - 8))}px`
      o.style.paddingTop = `${Math.max(8, Math.min(xy[1], innerHeight - d.offsetHeight - 8))}px`
    } else {
      o.style.paddingLeft = o.style.paddingTop = ''
    }
    // B302: new words do not lift the card under your thumb; they are below, a scroll away
    // (only once the card has settled: while it first opens it takes the height its words need)
    if (spec.kind === 'peek' && !desk()) {
      const n = String(spec.props.n)
      if (d.dataset.card !== n) {
        d.dataset.card = n
        d.dataset.since = String(Date.now())
        b.style.maxHeight = ''
      }
      const top = d.getBoundingClientRect().top,
        settled = Date.now() - Number(d.dataset.since) > 800
      if (settled && OV.maxH && top < (Number(d.dataset.top) || top) - 1) b.style.maxHeight = OV.maxH + 'px'
      d.dataset.top = String(top)
      OV.maxH = b.clientHeight
    } else {
      b.style.maxHeight = ''
      delete d.dataset.card
    }
  })
  useLayoutEffect(() => {
    // T227 #1: no ring on opening
    if (spec?.focus && desk())
      document.getElementById('dlgClose')?.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    if (spec) parkBox()
    els.dlgBody = body.current
  }, [spec])
  if (!spec || !parts) {
    if (spec && !parts) queueMicrotask(() => OV.spec === spec && closeDialog()) // what it was about is gone
    return <div id="overlay" ref={overlay} hidden />
  }
  const card = !!spec.card,
    pop = !!spec.pop && desk(),
    flush = card && !!spec.aboveComposer
  const oCls = [
    'fixed inset-0 z-40 flex items-end justify-center bg-black/40 pt-[max(env(safe-area-inset-top),0.75rem)] sm:items-center sm:p-6 dark:bg-black/60',
    card ? 'px-2' : '',
    card && !flush ? 'pb-2' : '',
    pop
      ? OV.popXY
        ? 'lg:items-start lg:justify-start lg:bg-transparent dark:lg:bg-transparent'
        : 'lg:items-start lg:justify-end lg:bg-transparent dark:lg:bg-transparent lg:pt-[3.75rem] lg:pr-3'
      : '',
  ].join(' ')
  const dCls = [
    'flex max-h-[min(88dvh,100%)] w-full max-w-2xl flex-col bg-white shadow-xl transition-transform duration-150 sm:rounded-3xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10',
    spec.walk ? 'h-[92%]' : '',
    spec.tall ? 'h-[88dvh] sm:h-[85dvh]' : '',
    card ? 'shadow-2xl overflow-hidden max-h-[92%]' : 'max-h-[88dvh]',
    card && !flush ? 'rounded-3xl' : 'rounded-t-3xl',
    pop ? 'lg:w-[24rem] lg:max-h-[80dvh] lg:rounded-2xl lg:ring-1 lg:ring-zinc-900/10 dark:lg:ring-white/10' : '',
  ].join(' ')
  const cardAim = (dx: number) => {
    const f = document.getElementById('dlgFoot'),
      fwd = f?.querySelector('[data-slot="fwd"]'),
      nx = f?.querySelector('[data-act="go-next"]')
    for (const [el, on] of [
      [fwd, dx > 80],
      [nx, dx < -80],
    ] as const)
      if (el) for (const c of ['bg-zinc-100', 'dark:bg-zinc-800']) el.classList.toggle(c, on)
  }
  const letGo = () => {
    if (FC.x === null) return
    const dx = FC.dx,
      on = FC.on,
      d = dlg.current
    FC.x = null
    FC.on = false
    if (d) {
      d.style.transition = ''
      d.style.transform = ''
    }
    cardAim(0)
    if (on && Math.abs(dx) > 80)
      document
        .getElementById('dlgFoot')
        ?.querySelector<HTMLElement>(dx > 0 ? '[data-slot="fwd"]' : '[data-act="go-next"]')
        ?.click()
  }
  const dragEnd = () => {
    if (!DRAG.on) return
    DRAG.on = false
    const d = dlg.current
    if (d) {
      d.style.transition = ''
      d.style.transform = ''
    }
    if (DRAG.dy > 80) closeDialog()
  }
  return (
    <div
      id="overlay"
      ref={overlay}
      data-card={card ? '1' : ''}
      data-above={spec.aboveComposer ? '1' : ''}
      className={oCls}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDialog()
      }}
    >
      <section
        id="dlg"
        ref={dlg}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlgTitle"
        className={dCls}
        onPointerDown={(e) => {
          if (
            e.pointerType === 'mouse' ||
            !(e.target as Element).closest('[data-handle], header') ||
            (e.target as Element).closest('button')
          )
            return
          Object.assign(DRAG, { id: e.pointerId, y0: e.clientY, dy: 0, on: true })
          if (dlg.current) dlg.current.style.transition = 'none'
        }}
        onPointerMove={(e) => {
          if (!DRAG.on || e.pointerId !== DRAG.id) return
          DRAG.dy = Math.max(0, e.clientY - DRAG.y0)
          if (dlg.current) dlg.current.style.transform = DRAG.dy ? `translateY(${DRAG.dy}px)` : ''
        }}
        onPointerUp={dragEnd}
        onPointerCancel={dragEnd}
      >
        <div data-handle className="flex shrink-0 touch-none justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <header
          className={`flex shrink-0 touch-none items-center gap-2 py-1 pr-2 pl-5 ${parts.head || parts.title ? '' : 'lg:hidden'}`}
        >
          <h2 id="dlgTitle" className="min-w-0 flex-1 truncate text-[17px] font-semibold">
            {parts.head ?? parts.title ?? ''}
          </h2>
          <span id="dlgExtra" className="contents">
            {parts.extra}
          </span>
          <button
            data-act="close"
            aria-label="Close"
            className="group grid size-11 shrink-0 place-items-center rounded-full"
            id="dlgClose"
          >
            <CloseX />
          </button>
        </header>
        <div id="dlgSub" hidden={!parts.sub} className="shrink-0">
          {parts.sub}
        </div>
        <div
          id="dlgBody"
          ref={body}
          className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 lg:scrollbar-thin lg:overscroll-contain lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${parts.foot ? 'pb-3' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'}`}
          onTouchStart={(e) => {
            FC.x =
              U.peek &&
              e.touches.length === 1 &&
              !(e.target as Element).closest('.overflow-x-auto, pre, textarea, input')
                ? e.touches[0].clientX
                : null
            FC.y = e.touches[0].clientY
            FC.dx = 0
            FC.on = false
          }}
          onTouchMove={(e) => {
            if (FC.x === null) return
            const t = e.touches[0],
              dx = t.clientX - FC.x,
              dy = t.clientY - FC.y
            if (!FC.on) {
              if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
                FC.x = null
                return
              } // scrolling the card
              if (Math.abs(dx) < 12) return
              FC.on = true
              if (dlg.current) dlg.current.style.transition = 'none'
            }
            FC.dx = dx
            if (dlg.current) dlg.current.style.transform = `translateX(${dx}px)`
            cardAim(dx)
          }}
          onTouchEnd={letGo}
          onTouchCancel={() => {
            FC.dx = 0
            letGo()
          }}
        >
          {parts.body}
        </div>
        <div id="dlgFoot" hidden={!parts.foot} className="shrink-0">
          {parts.foot}
        </div>
      </section>
    </div>
  )
}
