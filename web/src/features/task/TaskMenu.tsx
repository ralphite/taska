// A task's menu: on the phone a sheet of tiles (Edit, Copy for agent, New doc, Add subtask, Put under…, Later,
// Archive, Do this next, Move to… (another project), Delete) and its tags, priority and status; on the desktop a menu of rows
// with their keys (Status…, Priority… and Tags… open that field's choices), or just one field's choices (from its chip,
// or S, P, T). Props only.

import { useState, type ReactNode } from 'react'
import { TASK_ACTS, type TaskActId } from '../../model/taskActs'
import { closed, statusChoices, waitsInQueue } from '../../model/tasks'
import type { Task, Pri, Status } from '../../model/types'
import { tagsValue } from '../../model/optimistic'
import { priOpts, SegCtl } from '../../ui/Segments'
import { StateIcon, Icon } from '../../ui/Icon'
import { STATE_ICON, type IconName } from '../../ui/icon-paths'
import type { SheetParts } from '../../ui/Sheet'
import { CODE_TEXT, DANGER, FIELD, MENU_SEP, MUTED, STATE_ON, actIcon } from '../../ui/tones'

export interface TaskMenuEvents {
  edit(): void
  copy(): void
  /** what an agent reading it gets */
  agent(): void
  newDoc(): void
  addSub(): void
  /** `from`: the row it was chosen on (the desktop's picker opens under it) */
  reparent(from?: HTMLElement): void
  later(): void
  archive(on: boolean): void
  doNext(): void
  moveProject(): void
  remove(): void
  set(f: 'pri' | 'status', v: string): void
  /** the desktop's Status…, Priority…, Tags…: that field's choices, in place of the menu */
  field(arm: 's' | 'p' | 't'): void
  /** a # tag put on, or taken off when it has it (T855) */
  tag(t: string): void
  /** made a group, or a task again (T856) */
  group(on: boolean): void
  /** what it waits for, picked (`from`: the row it was chosen on; T857) */
  waitFor(from?: HTMLElement): void
}

export const STAT_BTN =
  'group flex min-w-0 items-center gap-1.5 bg-zinc-100 text-[13px] font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900'

/** A status button: the one the task has is pressed, and its icon's fill follows. */
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

const TaskHeadLine = ({ it, code }: { it: Task; code: string }) => (
  <span className="block truncate text-[15px] font-semibold">
    <span className={`mr-1.5 font-mono text-[13px] font-bold ${CODE_TEXT}`}>{code}</span>
    {it.title}
  </span>
)

export interface TaskMenuFacts {
  it: Task
  code: string
  parentCode: string | null
  /** the ask of Delete is waiting for its second click */
  asking: boolean
  /** one field's choices only (from its chip, or S, P, T) */
  arm: 's' | 'p' | 't' | null
  /** the keys of the desktop's rows, as the keys sheet writes them */
  keys: MenuKeys
  /** the project's tags, the most used first (T855) */
  allTags: readonly string[]
  /** the codes of what it waits for, not finished yet (T857) */
  waitsFor: readonly string[]
}

export interface MenuKeys {
  edit: string
  copy: string
  newDoc: string
  addSub: string
  reparent: string
  later: string
  archive: string
  status: string
  pri: string
  tags: string
}

/** A new tag, typed: Enter puts it on (letters, digits, - and _, as the server takes them). */
function NewTag({ on, small }: { on: TaskMenuEvents; small: boolean }) {
  const [t, setT] = useState('')
  const ok = (tagsValue(t) ?? []).length === 1
  return (
    <input
      value={t}
      onChange={(e) => setT(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !ok) return
        e.preventDefault()
        on.tag((tagsValue(t) ?? [])[0])
        setT('')
      }}
      placeholder="#new tag"
      aria-label="New tag"
      enterKeyHint="done"
      className={`${FIELD} ${small ? 'h-8 text-sm' : 'h-11'} w-full`}
    />
  )
}

/** The project's tags and the task's own, each put on or taken off by a tap; a new one typed. */
function TagChoices({ all, it, on }: { all: readonly string[]; it: Task; on: TaskMenuEvents }) {
  const tags = [...it.tags.filter((t) => !all.includes(t)), ...all]
  return (
    <div className="flex flex-col gap-2">
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button key={t} onClick={() => on.tag(t)} aria-pressed={it.tags.includes(t)} className={`${STAT_BTN} h-11 rounded-xl px-3.5`}>
              #{t}
            </button>
          ))}
        </div>
      ) : null}
      <NewTag on={on} small={false} />
    </div>
  )
}

/** The phone's sheet. */

export function taskMenuSheet({ it, code, parentCode, asking, arm, allTags, waitsFor }: TaskMenuFacts, on: TaskMenuEvents): SheetParts {
  const group = !!it.group
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
  const next = waitsInQueue(it) ? tile('next', it.rank == null ? 'totop' : 'undo', it.rank == null ? 'Do this next' : 'Back in order', on.doNext, it.rank == null ? `first ${it.pri} in queue` : 'where it was, by age') : null
  const act = (id: TaskActId, run: () => void) => tile(id, actIcon(id), TASK_ACTS[id].label, run)
  const state = it.archived
    ? [act('unarchive', () => on.archive(false))]
    : closed(it.status)
      ? [act('archive', () => on.archive(true))]
      : [tile('later', actIcon('later'), TASK_ACTS[it.when === 'now' ? 'later' : 'now'].label, on.later), act('archive', () => on.archive(true))]
  const lab = (t: string) => <div className="px-1 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t}</div>
  const tags = (
    <div>
      {lab('Tags')}
      <TagChoices all={allTags} it={it} on={on} />
    </div>
  )
  const pri =
    (
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
  const head = <TaskHeadLine it={it} code={code} />
  const only = arm === 's' ? status : arm === 'p' ? pri : arm === 't' ? tags : null
  if (only) return { head, body: only }
  return {
    head,
    body: (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2">
          {tile('edit', 'pencil', 'Edit', on.edit)}
          {tile('copy', 'copy', 'Copy for agent', on.copy)}
          {tile('agent', 'bot', 'What agents see', on.agent)}
          {(
            <>
              {tile('doc', 'docplus', 'New doc', on.newDoc)}
              {tile('sub', 'listplus', 'Add subtask', on.addSub)}
              {tile('reparent', 'indent', 'Put under…', () => on.reparent(), parentCode ? `now under ${parentCode}` : 'stands on its own')}
            </>
          )}
          {group ? null : tile('wait', 'hourglass', 'Wait for…', () => on.waitFor(), waitsFor?.length ? `now ${waitsFor.join(', ')}` : '')}
          {group ? tile('group', 'tasks', 'Make a task', () => on.group(false)) : tile('group', 'folder', 'Make a group', () => on.group(true))}
          {state}
          {next}
          {tile('move', 'arrow', 'Move to…', on.moveProject)}
        </div>
        {tags}
        {pri}
        {group ? null : status}
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <button onClick={on.remove} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 text-[15px] font-semibold hover:bg-red-100 dark:bg-red-400/10 dark:hover:bg-red-400/20 ${DANGER}`}>
            <Icon n="trash" c="size-4.5" />
            {asking ? `Delete ${code}?` : 'Delete'}
          </button>
        </div>
      </div>
    ),
  }
}

/** The desktop's menu: rows with their keys, or one field's choices. */
export function taskMenuPop({ it, code, parentCode, asking, arm, keys, allTags, waitsFor }: TaskMenuFacts, on: TaskMenuEvents): SheetParts {
  const group = !!it.group
  const row = (key: string, icon: IconName | ReactNode, label: ReactNode, k: string, run: (from: HTMLElement) => void, sub = '', danger = false) => (
    <button key={key} onClick={(e) => run(e.currentTarget)} className={`flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm ${danger ? `${DANGER} hover:bg-red-50 dark:hover:bg-red-400/10` : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
      {typeof icon === 'string' ? <Icon n={icon as IconName} c={`size-[18px] ${danger ? '' : 'text-zinc-500 dark:text-zinc-400'}`} /> : icon}
      <span className="min-w-0 flex-1 truncate">
        {label}
        {sub ? <span className={`ml-2 text-xs ${MUTED}`}>{sub}</span> : null}
      </span>
      {k ? <kbd className={`grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold ring-1 ring-zinc-300 dark:ring-zinc-600 ${MUTED}`}>{k}</kbd> : null}
    </button>
  )
  if (arm === 't') {
    const tags = [...it.tags.filter((t) => !allTags.includes(t)), ...allTags]
    return {
      menu: true,
      body: (
        <div className="-mx-1 -mt-1">
          <div className="px-1 pb-1">
            <NewTag on={on} small />
          </div>
          {tags.map((t) => (
            <button key={t} data-f="tags" onClick={() => on.tag(t)} aria-pressed={it.tags.includes(t)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 aria-pressed:font-semibold dark:hover:bg-zinc-800">
              <span className="min-w-0 flex-1 truncate">#{t}</span>
              {it.tags.includes(t) ? <Icon n="check" c="size-4 text-blue-600 dark:text-blue-400" sw="2.5" /> : null}
            </button>
          ))}
        </div>
      ),
    }
  }
  if (arm) {
    const f = arm === 'p' ? 'pri' : 'status'
    const cur = String(it[f])
    const opts: [string, ReactNode, string][] =
      arm === 'p'
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
              {cur === v ? <Icon n="check" c="size-4 text-blue-600 dark:text-blue-400" sw="2.5" /> : <kbd className={`grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold ring-1 ring-zinc-300 dark:ring-zinc-600 ${MUTED}`}>{k}</kbd>}
            </button>
          ))}
        </div>
      ),
    }
  }
  // in progress it is first already: nothing to move
  const next = waitsInQueue(it) ? row('next', it.rank == null ? 'totop' : 'undo', it.rank == null ? 'Do this next' : 'Back in order', '', on.doNext, it.rank == null ? `first ${it.pri} in queue` : 'where it was, by age') : null
  const act = (id: TaskActId, k: string, run: () => void) => row(id, actIcon(id), TASK_ACTS[id].label, k, run)
  const state = it.archived
    ? [act('unarchive', keys.archive, () => on.archive(false))]
    : closed(it.status)
      ? [act('archive', keys.archive, () => on.archive(true))]
      : [row('later', actIcon('later'), TASK_ACTS[it.when === 'now' ? 'later' : 'now'].label, keys.later, on.later), act('archive', keys.archive, () => on.archive(true))]
  return {
    menu: true,
    body: (
      <div className="flex flex-col gap-3">
        <div className="-mx-1 -mt-1">
          {row('edit', 'pencil', 'Edit', keys.edit, on.edit)}
          {row('copy', 'copy', 'Copy for agent', keys.copy, on.copy)}
          {row('agent', 'bot', 'What agents see', '', on.agent)}
          <div className={MENU_SEP} />
          {group ? null : row('status', <StateIcon s={it.status} cls="size-[18px]" />, 'Status…', keys.status, () => on.field('s'), statusChoices(it).find(([s]) => s === it.status)?.[1] ?? '')}
          {row('pri', 'up', 'Priority…', keys.pri, () => on.field('p'), it.pri)}
          {row('tags', <span className="grid size-[18px] place-items-center text-[15px] font-semibold text-zinc-500 dark:text-zinc-400">#</span>, 'Tags…', keys.tags, () => on.field('t'), it.tags.map((t) => '#' + t).join(' '))}
          <div className={MENU_SEP} />
          {(
            <>
              {row('doc', 'docplus', 'New doc', keys.newDoc, on.newDoc)}
              {row('sub', 'listplus', 'Add subtask', keys.addSub, on.addSub)}
              {row('reparent', 'indent', 'Put under…', keys.reparent, on.reparent, parentCode ? 'now under ' + parentCode : 'stands on its own')}
            </>
          )}
          {group ? null : row('wait', 'hourglass', 'Wait for…', '', (from) => on.waitFor(from), waitsFor?.length ? 'now ' + waitsFor.join(', ') : '')}
          {group ? row('group', 'tasks', 'Make a task', '', () => on.group(false)) : row('group', 'folder', 'Make a group', '', () => on.group(true))}
          {state}
          {next}
          {row('move', 'arrow', 'Move to project…', '', on.moveProject)}
          <div className={MENU_SEP} />
          {row('delete', 'trash', asking ? `Delete ${code}?` : 'Delete', '', on.remove, '', true)}
        </div>
      </div>
    ),
  }
}
