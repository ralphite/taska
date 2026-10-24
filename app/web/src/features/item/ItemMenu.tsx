// An item's menu: on the phone a sheet of tiles (Edit, Copy for agent, New doc, Add subitem, Put under…, Later,
// Archive, Do this next, Move to project…, Delete) and its type, priority and status; on the desktop a menu of rows
// with their keys, or just one field's choices (from its chip, or S, P, T). Props only.

import type { ReactNode } from 'react'
import { closed, inQueue, statusChoices } from '../../model/items'
import type { Item, Pri, Status } from '../../model/types'
import { WORK_TYPES } from '../../model/words'
import { StateIcon, Icon } from '../../ui/Icon'
import { STATE_ICON, type IconName } from '../../ui/icon-paths'
import type { SheetParts } from '../../ui/Sheet'
import { STATE_ON, TYPE_TEXT } from '../../ui/tones'

export interface ItemMenuEvents {
  edit(): void
  copy(): void
  newDoc(): void
  addSub(): void
  /** `from`: the row it was chosen on (the desktop's picker opens under it) */
  reparent(from?: HTMLElement): void
  later(): void
  archive(on: boolean): void
  doNext(): void
  moveProject(): void
  remove(): void
  set(f: 'type' | 'pri' | 'status', v: string): void
}

export const SEG_ON =
  'aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-zinc-900/5 dark:aria-pressed:bg-zinc-600 dark:aria-pressed:text-white dark:aria-pressed:ring-white/10'
export const STAT_BTN =
  'group flex min-w-0 items-center gap-1.5 bg-zinc-100 text-[13px] font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900'

export function SegCtl({ opts, on, small = false, pick }: { opts: [string, ReactNode][]; on: string; small?: boolean; pick(v: string): void }) {
  return (
    <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {opts.map(([v, t]) => (
        <button
          key={v}
          onClick={() => pick(v)}
          aria-pressed={v === on}
          className={`relative flex ${small ? 'h-7' : 'h-9'} min-w-0 flex-1 items-center justify-center gap-1 rounded-lg text-[13px] font-medium text-zinc-600 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100 ${SEG_ON}`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

export const typeOpts = (withRule: boolean): [string, ReactNode][] => [
  ...(withRule ? [] : [['all', 'All'] as [string, ReactNode]]),
  ...[...WORK_TYPES, ...(withRule ? ['rule' as const] : [])].map((t) => [t, <span className="truncate">{t[0].toUpperCase() + t.slice(1)}</span>] as [string, ReactNode]),
]
const P0 = <span className="font-semibold text-red-600 dark:text-red-400">P0</span>
export const priOpts = (withAll: boolean): [string, ReactNode][] => [...(withAll ? [['all', 'Any'] as [string, ReactNode]] : []), ['P0', P0], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3']]

/** A status button: the one the item has is pressed, and its icon's fill follows. */
const StatIcon = ({ s, t, size }: { s: string; t: string; size: string }) => (
  <StateIcon
    s={s}
    label={t}
    cls={size}
    tone={
      STATE_ICON[s][1] +
      ' ' +
      STATE_ON[s as Status]
        .split(' ')
        .map((c) => c.replace(/^(dark:)?/, '$1group-aria-pressed:'))
        .join(' ')
    }
  />
)

const ItemHeadLine = ({ it, code }: { it: Item; code: string }) => (
  <span className="block truncate text-[15px] font-semibold">
    <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}`}>{code}</span>
    {it.title}
  </span>
)

export interface ItemMenuFacts {
  it: Item
  code: string
  parentCode: string | null
  /** the ask of Delete is waiting for its second click */
  asking: boolean
  /** one field's choices only (from its chip, or S, P, T) */
  arm: 's' | 'p' | 't' | null
  /** the keys of the desktop's rows, as the keys sheet writes them */
  keys: MenuKeys
}

export interface MenuKeys {
  edit: string
  copy: string
  newDoc: string
  addSub: string
  reparent: string
  later: string
  archive: string
}

/** The phone's sheet. */
export function itemMenuSheet({ it, code, parentCode, asking, arm }: ItemMenuFacts, on: ItemMenuEvents): SheetParts {
  const tile = (key: string, icon: IconName, label: ReactNode, run: () => void, sub = '') => (
    <button
      key={key}
      onClick={run}
      className="flex h-19 flex-col items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 px-1 text-[13px] leading-tight font-medium text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      <Icon n={icon} c="size-5.5 text-zinc-600 dark:text-zinc-300" />
      <span className="text-center">
        {label}
        {sub ? <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">{sub}</span> : null}
      </span>
    </button>
  )
  const next = inQueue(it) && it.when === 'now' ? tile('next', it.rank == null ? 'totop' : 'undo', it.rank == null ? 'Do this next' : 'Back in order', on.doNext, it.rank == null ? `first of the ${it.pri}s` : '') : null
  const state = it.archived
    ? [tile('unarchive', 'unarchive', 'Unarchive', () => on.archive(false))]
    : closed(it.status)
      ? [tile('archive', 'archive', 'Archive', () => on.archive(true))]
      : [it.type === 'rule' ? null : tile('later', 'clock', it.when === 'now' ? 'Later' : 'Back to now', on.later), tile('archive', 'archive', 'Archive', () => on.archive(true))]
  const lab = (t: string) => <div className="px-1 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t}</div>
  const type = (
    <div>
      {lab('Type')}
      <SegCtl opts={typeOpts(true)} on={it.type} pick={(v) => on.set('type', v)} />
    </div>
  )
  const pri =
    it.type === 'rule' ? null : (
      <div>
        {lab('Priority')}
        <SegCtl opts={priOpts(false)} on={it.pri} pick={(v) => on.set('pri', v as Pri)} />
      </div>
    )
  const status = (
    <div>
      {lab('Status')}
      <div className="grid grid-cols-3 gap-1.5">
        {statusChoices(it).map(([s, t]) => (
          <button key={s} onClick={() => on.set('status', s)} aria-pressed={it.status === s} className={`${STAT_BTN} h-11 rounded-xl px-2.5`}>
            <StatIcon s={s} t={t} size="size-4.5" />
            <span className="truncate">{t}</span>
          </button>
        ))}
      </div>
    </div>
  )
  const head = <ItemHeadLine it={it} code={code} />
  const only = arm === 's' ? status : arm === 'p' ? pri : arm === 't' ? type : null
  if (only) return { head, body: only }
  return {
    head,
    body: (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2">
          {tile('edit', 'pencil', 'Edit', on.edit)}
          {tile('copy', 'copy', 'Copy for agent', on.copy)}
          {it.type === 'rule' ? null : (
            <>
              {tile('doc', 'docplus', 'New doc', on.newDoc)}
              {tile('sub', 'listplus', 'Add subitem', on.addSub)}
              {tile('reparent', 'indent', 'Put under…', () => on.reparent(), parentCode ? `now under ${parentCode}` : '')}
            </>
          )}
          {state}
          {next}
          {tile('move', 'arrow', 'Move to project…', on.moveProject)}
          {tile('delete', 'trash', asking ? `Delete ${code}?` : 'Delete', on.remove)}
        </div>
        {type}
        {pri}
        {status}
      </div>
    ),
  }
}

/** The desktop's menu: rows with their keys, or one field's choices. */
export function itemMenuPop({ it, code, parentCode, asking, arm, keys }: ItemMenuFacts, on: ItemMenuEvents): SheetParts {
  const row = (key: string, icon: IconName, label: ReactNode, k: string, run: (from: HTMLElement) => void, sub = '') => (
    <button key={key} onClick={(e) => run(e.currentTarget)} className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
      <Icon n={icon} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">
        {label}
        {sub ? <span className="ml-2 text-xs text-zinc-400">{sub}</span> : null}
      </span>
      {k ? <kbd className="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600">{k}</kbd> : null}
    </button>
  )
  if (arm) {
    const f = arm === 't' ? 'type' : arm === 'p' ? 'pri' : 'status'
    const cur = String(it[f])
    const opts: [string, ReactNode, string][] =
      arm === 't'
        ? typeOpts(true).map(([v, l]) => [v, l, v[0].toUpperCase()])
        : arm === 'p'
          ? priOpts(false).map(([v, l]) => [v, l, v.slice(1)])
          : statusChoices(it).map(([v, t], i) => [
              v,
              <span key={v} className="flex items-center gap-2">
                <StatIcon s={v} t={t} size="size-4" />
                {t}
              </span>,
              String(i + 1),
            ])
    return {
      menu: true,
      body: (
        <div className="-mx-1 -mt-1">
          {opts.map(([v, l, k]) => (
            <button
              key={v}
              data-f={f}
              data-v={v}
              onClick={() => on.set(f, v)}
              aria-pressed={cur === v}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 aria-pressed:font-semibold dark:hover:bg-zinc-800"
            >
              <span className="min-w-0 flex-1 truncate">{l}</span>
              {cur === v ? <Icon n="check" c="size-4 text-blue-600 dark:text-blue-400" sw="2.5" /> : <kbd className="font-sans text-[11px] font-semibold text-zinc-400">{k}</kbd>}
            </button>
          ))}
        </div>
      ),
    }
  }
  const next = inQueue(it) && it.when === 'now' ? row('next', it.rank == null ? 'totop' : 'undo', it.rank == null ? 'Do this next' : 'Back in order', '', on.doNext, it.rank == null ? `first ${it.pri} in queue` : 'where it was, by age') : null
  const state = it.archived
    ? [row('unarchive', 'unarchive', 'Unarchive', keys.archive, () => on.archive(false))]
    : closed(it.status)
      ? [row('archive', 'archive', 'Archive', keys.archive, () => on.archive(true))]
      : [it.type === 'rule' ? null : row('later', 'clock', it.when === 'now' ? 'Later' : 'Back to now', keys.later, on.later), row('archive', 'archive', 'Archive', keys.archive, () => on.archive(true))]
  return {
    menu: true,
    body: (
      <div className="flex flex-col gap-3">
        <div className="-mx-1 -mt-1">
          {row('edit', 'pencil', 'Edit', keys.edit, on.edit)}
          {row('copy', 'copy', 'Copy for agent', keys.copy, on.copy)}
          {it.type === 'rule' ? null : (
            <>
              {row('doc', 'docplus', 'New doc', keys.newDoc, on.newDoc)}
              {row('sub', 'listplus', 'Add subitem', keys.addSub, on.addSub)}
              {row('reparent', 'indent', 'Put under…', keys.reparent, on.reparent, parentCode ? 'now under ' + parentCode : 'stands on its own')}
            </>
          )}
          {state}
          {next}
          {row('move', 'arrow', 'Move to project…', '', on.moveProject)}
          {row('delete', 'trash', asking ? `Delete ${code}?` : 'Delete', '', on.remove)}
        </div>
      </div>
    ),
  }
}
