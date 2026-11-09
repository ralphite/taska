// Over the list while rows are picked: how many, what can be done to them all, and Clear. Props only.

import { ITEM_ACTS, type ItemActId } from '../../model/itemActs'
import { DID } from '../../model/words'
import { Icon } from '../../ui/Icon'

/** What can be done to them all (model/itemActs), and what each sets. */
export const SEL_ACTS: readonly [act: ItemActId, field: string, value: unknown][] = [
  ['done', 'status', 'done'],
  ['later', 'when', 'later'],
  ['now', 'when', 'now'],
  ['archive', 'archived', true],
  ['drop', 'status', 'dropped'],
]
/** how the toast says it of them: "are done" */
const saidOfThem = (f: string, v: unknown) => (f === 'archived' ? 'archived' : DID[String(v)].replace(/^is /, 'are '))

export function SelBar({ n, on }: { n: number; on: { set(f: string, v: unknown, said: string): void; clear(): void } }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-blue-200 bg-blue-50 py-1.5 pr-2 pl-4 dark:border-blue-400/25 dark:bg-zinc-900">
      <span className="mr-auto text-sm font-semibold whitespace-nowrap text-blue-950 dark:text-blue-100">{n} selected</span>
      {SEL_ACTS.map(([act, f, v]) => (
        <button key={act} onClick={() => on.set(f, v, saidOfThem(f, v))} className="flex h-8 items-center rounded-lg px-2 text-[13px] font-medium whitespace-nowrap text-zinc-700 hover:bg-white dark:text-zinc-200 dark:hover:bg-zinc-800">
          {ITEM_ACTS[act].label}
        </button>
      ))}
      <button onClick={on.clear} title="Clear · Esc" aria-label="Clear the selection" className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white dark:hover:bg-zinc-800">
        <Icon n="x" c="size-4" />
      </button>
    </div>
  )
}
