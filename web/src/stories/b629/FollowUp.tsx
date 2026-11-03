// B629 version 3: has it been done? The list answers "has what I asked for been done yet?": each input carries a
// small track from when it was said, through where it went (the item it made or joined, an agent, another project),
// to done (the item's own status, or the agent having handled it). The items come next, then the words, quieter:
// here they are the reminder of what was asked, not the thing read.
import type { ReactNode } from 'react'
import { Icon, StateIcon } from '../../ui/Icon'
import { Acts, Files, Head, ItemLink, Next, Nothing, useList, Words, WORD, type Entry, type Outcome } from './inputsDemo'

type Reach = 'done' | 'now' | 'bad' | 'not'
interface Stop {
  mark: ReactNode
  label: ReactNode
  reach: Reach
}

const DOT = {
  done: <span className="size-2.5 rounded-full bg-zinc-800 dark:bg-zinc-200" />,
  now: <span className="size-2.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />,
}
const TONE: Record<Reach, string> = {
  done: 'text-zinc-800 dark:text-zinc-200',
  now: 'font-medium text-blue-600 dark:text-blue-400',
  bad: 'font-medium text-red-600 dark:text-red-400',
  not: 'text-zinc-400 dark:text-zinc-500',
}

/** how far an item's status has come: done, being worked on (blue, as its mark), or not started */
const reachOf = (s: string): Reach => (s === 'done' ? 'done' : s === 'doing' ? 'now' : 'not')

/** where it went, and how far that has come */
function stops(o: Outcome): [Stop, Stop] {
  // a stop not reached yet: the mark of an item not started, the same size as the item marks it stands for
  const goal = (word: string): Stop => ({ mark: <StateIcon s="open" cls="size-4" />, label: word, reach: 'not' })
  switch (o.k) {
    case 'transcribing':
    case 'organizing':
      return [{ mark: DOT.now, label: WORD[o.k], reach: 'now' }, goal('Done')]
    case 'failed':
      return [{ mark: <Icon n="alert" c="size-4 text-red-600 dark:text-red-400" sw="2" />, label: WORD.failed, reach: 'bad' }, goal('Done')]
    case 'undone':
      return [{ mark: <Icon n="undo" c="size-4 text-zinc-500" sw="2" />, label: WORD.undone, reach: 'not' }, goal('Done')]
    case 'agent':
      return [{ mark: DOT.done, label: WORD.agent, reach: 'done' }, goal('Handled')]
    case 'handled':
      return [{ mark: DOT.done, label: WORD.agent, reach: 'done' }, { mark: <StateIcon s="done" label="Handled" cls="size-4" />, label: 'Handled', reach: 'done' }]
    case 'moved':
      // it goes on in the other project: the last stop is the way there
      return [
        { mark: DOT.done, label: WORD.moved(o), reach: 'done' },
        {
          mark: <Icon n="arrow" c="size-4 text-blue-600 dark:text-blue-400" sw="2" />,
          label: (
            <a href="#" onClick={(ev) => ev.preventDefault()} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Open {o.as} there
            </a>
          ),
          reach: 'not',
        },
      ]
    default: {
      const items = o.k === 'filed' ? o.items.map((x) => x.item) : [o.item]
      // what was done; the items themselves are listed under the track, with their codes
      const did = o.k === 'answer' ? WORD.answer : o.items.every((x) => x.did === o.items[0].did) ? o.items[0].did : 'Created and added to'
      const went: Stop = { mark: DOT.done, label: did, reach: 'done' }
      if (items.length === 1) {
        const it = items[0]
        return [went, { mark: <StateIcon {...it.status} cls="size-4" />, label: it.status.label, reach: reachOf(it.status.s) }]
      }
      const done = items.filter((it) => it.status.s === 'done').length
      const s = done === items.length ? 'done' : items.some((it) => it.status.s === 'doing') ? 'doing' : 'open'
      return [went, { mark: <StateIcon s={s} cls="size-4" />, label: `${done} of ${items.length} done`, reach: reachOf(s) }]
    }
  }
}

/** Said, then where it went, then done: three marks joined by a line, solid as far as it has come. */
function Track({ e }: { e: Entry }) {
  const [went, end] = stops(e.out)
  const all: Stop[] = [{ mark: DOT.done, label: 'Said', reach: 'done' }, went, end]
  return (
    <ol className="grid grid-cols-3">
      {all.map((s, i) => {
        const next = all[i + 1]
        return (
          <li key={i} className="relative min-w-0 pr-2">
            <span className="relative z-10 grid size-4 place-items-center bg-white dark:bg-zinc-950">{s.mark}</span>
            {next ? <span className={`absolute top-2 right-0 left-5 h-0.5 rounded-full ${next.reach === 'done' ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-200 dark:bg-zinc-700'}`} /> : null}
            <span className={`mt-1 block text-xs leading-4 break-words ${TONE[s.reach]}`}>{s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Unit({ e, desk, words, opened, toggle }: { e: Entry; desk: boolean; words: readonly string[]; opened: boolean; toggle(): void }) {
  const o = e.out
  const items = o.k === 'filed' ? o.items.map((x) => x.item) : o.k === 'answer' ? [o.item] : []
  return (
    // the phone: the track under the number, across the row; the desktop: the track in a column of its own on the right,
    // the same place on every row, so the eye runs down it
    <li className={`group/row relative border-t border-zinc-100 py-3.5 first:border-t-0 dark:border-zinc-800/70 ${desk ? 'grid grid-cols-[minmax(0,1fr)_22rem] gap-x-8' : 'px-4'}`}>
      {desk ? (
        <div className="col-start-2 row-span-2 row-start-1 pt-1">
          <Track e={e} />
        </div>
      ) : null}
      <div className="flex min-h-6 items-center gap-2">
        <span className="font-mono text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{e.code}</span>
        <span className="text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">{e.when}</span>
        {/* the desktop: at the end of this line (the track's column on the right stays clear) */}
        <span className="ml-auto flex">{desk ? <Acts e={e} desk at="-my-1" /> : <Acts e={e} desk={false} />}</span>
      </div>
      <div className="min-w-0">
        {desk ? null : (
          <div className="mt-2.5">
            <Track e={e} />
          </div>
        )}
        {items.length ? (
          <div className="mt-2 flex flex-col items-start gap-0.5">
            {items.map((it) => (
              <ItemLink key={it.n} it={it} cls="text-sm" />
            ))}
          </div>
        ) : null}
        {o.k === 'failed' || o.k === 'undone' ? (
          <div className="mt-1">
            <Next o={o} />
          </div>
        ) : null}
        <Words e={e} words={words} opened={opened} toggle={toggle} upTo="max-h-12" cls="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400" />
        {e.r.files.length ? (
          <div className="mt-2">
            <Files r={e.r} size="size-12" />
          </div>
        ) : null}
      </div>
    </li>
  )
}

export function FollowUp({ desk, q0 = '' }: { desk: boolean; q0?: string }) {
  const { q, setQ, words, list, total, opened, toggle } = useList(q0)
  return (
    <div className="flex flex-col">
      <Head desk={desk} shown={list.length} total={total} q={q} setQ={setQ} />
      {list.length ? (
        <ul className={`flex flex-col border-t ${desk ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-100 pb-6 dark:border-zinc-800'}`}>
          {list.map((e) => (
            <Unit key={e.r.id} e={e} desk={desk} words={words} opened={opened.has(e.r.id)} toggle={() => toggle(e.r.id)} />
          ))}
        </ul>
      ) : (
        <Nothing q={q} />
      )}
    </div>
  )
}
