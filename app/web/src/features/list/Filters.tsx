// The list's filters: type, when (Archive), status (not on Items, whose views are its status), priority and sort,
// and saving them as a view of your own (Items). On the phone a sheet with Show N items; on the desktop a row under
// the search with what is set, opening to the controls. Props only.

import { useState, type ReactNode } from 'react'
import type { ListKey, ListQuery } from '../../model/route'
import { ARCHIVE_FILTER_WORD, RULE_STATUS_WORD, SORT_WORDS, STATUS_FILTER_WORD, type Tab } from '../../model/words'
import { Icon } from '../../ui/Icon'
import type { SheetParts } from '../../ui/Sheet'
import { FIELD, HIT, PRIMARY } from '../../ui/tones'
import { priOpts, SegCtl, typeOpts } from '../../ui/Segments'

export interface FilterEvents {
  set(k: ListKey, v: string): void
  unset(k: ListKey): void
  reset(): void
  saveView(name: string): void
}

export function FilterControls({ tab, list, small = false, on }: { tab: Tab; list: ListQuery; small?: boolean; on: FilterEvents }) {
  const [name, setName] = useState('')
  const lab = (t: string) => <div className={`px-1 ${small ? 'pb-1 text-[11px]' : 'pb-2 text-xs'} font-semibold text-zinc-500 dark:text-zinc-400`}>{t}</div>
  const statuses: [string, string][] = [['all', 'All'], ...(Object.entries(tab === 'rules' ? RULE_STATUS_WORD : tab === 'archive' ? ARCHIVE_FILTER_WORD : STATUS_FILTER_WORD) as [string, string][])]
  return (
    <>
      {tab === 'rules' ? null : (
        <div>
          {lab('Type')}
          <SegCtl opts={typeOpts(false)} on={list.type} small={small} pick={(v) => on.set('type', v)} />
        </div>
      )}
      {tab === 'archive' ? (
        <div>
          {lab('When')}
          <SegCtl
            opts={[
              ['all', 'Any time'],
              ['now', 'Now'],
              ['later', 'Later'],
            ]}
            on={list.when}
            small={small}
            pick={(v) => on.set('when', v)}
          />
        </div>
      ) : null}
      {tab === 'items' ? null : (
        <div>
          {lab('Status')}
          <div className="flex flex-wrap gap-1.5">
            {statuses.map(([v, t]) => (
              <button
                key={v}
                onClick={() => on.set('status', v)}
                aria-pressed={list.status === v}
                className={`relative ${small ? 'h-7 px-2.5' : 'h-9 px-3.5'} rounded-full bg-zinc-100 text-[13px] font-medium text-zinc-700 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === 'rules' ? null : (
        <div>
          {lab('Priority')}
          <SegCtl opts={priOpts(true)} on={list.pri} small={small} pick={(v) => on.set('pri', v)} />
        </div>
      )}
      <div>
        {lab('Sort')}
        <SegCtl opts={SORT_WORDS} on={list.sort} small={small} pick={(v) => on.set('sort', v)} />
      </div>
      {tab === 'items' ? (
        <div>
          {lab('Save as a view')}
          <div className="flex items-center gap-1.5">
            <input
              placeholder="Name"
              aria-label="View name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                on.saveView(name)
                setName('')
              }}
              className={`${FIELD} h-9 min-w-0 flex-1 py-1.5 text-sm`}
            />
            <button
              onClick={() => (on.saveView(name), setName(''))}
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

/** The phone's sheet: the controls, and Show with what it will show. */
export function filtersSheet({ tab, list, filtered, shown, open }: { tab: Tab; list: ListQuery; filtered: boolean; shown: number; open: number }, on: FilterEvents & { close(): void }): SheetParts {
  return {
    title: 'Filters',
    extra: filtered ? (
      <button onClick={on.reset} className="h-11 rounded-full px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">
        Clear all
      </button>
    ) : null,
    body: (
      <div className="flex flex-col gap-5">
        <FilterControls tab={tab} list={list} on={on} />
        <button onClick={on.close} className={`${PRIMARY} w-full`}>
          Show {tab === 'items' && open !== shown ? `${open} open, ${shown - open} finished` : `${shown} ${tab === 'rules' ? 'rule' : 'item'}${shown === 1 ? '' : 's'}`}
        </button>
      </div>
    ),
  }
}

/** The desktop's row under the search: what is set, Clear, and the controls when opened. */
export function DeskFilters({ tab, list, set, open, place, hidden, on }: {
  tab: Tab
  list: ListQuery
  set: [ListKey, ReactNode][]
  open: boolean
  place: string
  hidden: boolean
  on: FilterEvents & { toggle(): void }
}) {
  return (
    <div hidden={hidden} className={`border-zinc-200 lg:border-r lg:border-b dark:border-zinc-800 ${place}`}>
      {!set.length && !open ? null : (
        <>
          <div className="flex min-h-11 flex-wrap items-center gap-2 px-3 py-1.5">
            <FilterChips set={set} onUnset={(k) => on.unset(k as ListKey)} />
            {set.length ? (
              <button onClick={on.reset} className="ml-auto h-8 px-1 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Clear
              </button>
            ) : (
              <span className="ml-auto" />
            )}
            <button onClick={on.toggle} aria-label={open ? 'Fold the filters' : 'Show the filters'} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Icon n={open ? 'chevup' : 'down'} c="size-4" sw="2" />
            </button>
          </div>
          {open ? (
            <div className="flex flex-col gap-3 px-3 pb-3">
              <FilterControls tab={tab} list={list} small on={on} />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export function FilterChips({ set, onUnset }: { set: [string, ReactNode][]; onUnset(k: string): void }) {
  return (
    <>
      {set.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onUnset(k)}
          className={`${HIT} flex h-8 shrink-0 items-center gap-1 rounded-full bg-blue-50 pr-2 pl-3 text-[13px] font-medium text-blue-800 ring-1 ring-blue-200 ring-inset hover:bg-blue-100 lg:h-7 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/25 dark:hover:bg-blue-400/20`}
        >
          {label}
          <Icon n="x" c="size-3.5" sw="2.25" />
        </button>
      ))}
    </>
  )
}

/** The phone's row of the filters set, under the tabs, with Clear. */
export function FilterStrip({ set, hidden, onUnset, onReset }: { set: [string, ReactNode][]; hidden: boolean; onUnset(k: string): void; onReset(): void }) {
  return (
    <div hidden={hidden} className="flex h-11 shrink-0 [scrollbar-width:none] items-center gap-2 overflow-x-auto border-b border-zinc-100 px-4 lg:hidden dark:border-zinc-800/70">
      <FilterChips set={set} onUnset={onUnset} />
      <button onClick={onReset} className="ml-auto h-11 shrink-0 px-1 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
        Clear
      </button>
    </div>
  )
}
