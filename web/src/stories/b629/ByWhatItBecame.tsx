// B629 version 1: inputs by what they became. The list answers "what did my words turn into?": each item an input
// made or went into heads its own group, with the inputs that went into it under it; the inputs left for an agent,
// handled by one, or moved to another project make groups of their own; those Taska's organizer has not placed yet
// come first. Groups follow the latest input in them, newest first; an input that made two items is under both.
import type { ReactNode } from 'react'
import { plural } from '../../model/words'
import { Icon, StateIcon } from '../../ui/Icon'
import { TYPE_TEXT } from '../../ui/tones'
import { Acts, Files, Head, ItemLink, Next, Nothing, State, Words, pending, useList, type Entry, type ItemRef, WORD } from './inputsDemo'

type Key = 'pending' | 'agent' | 'handled' | 'moved' | `item ${number}`
interface Under {
  e: Entry
  /** how it went into the group's item: Created, Added to (said "Added"), Answer */
  how: string | null
  /** the other items it made or went into */
  also: ItemRef[]
  /** shown in full in a group above already (under this item): here its first line only */
  again?: boolean
  fullIn?: ItemRef | null
}
interface Group {
  key: Key
  item: ItemRef | null
  list: Under[]
}

const LABEL: Record<'pending' | 'agent' | 'handled' | 'moved', { icon: 'hourglass' | 'bot' | 'check' | 'arrow'; text: string }> = {
  pending: { icon: 'hourglass', text: 'Not organized yet' },
  agent: { icon: 'bot', text: WORD.agent },
  handled: { icon: 'check', text: WORD.handled },
  moved: { icon: 'arrow', text: 'Moved to other projects' },
}

function groups(list: Entry[]): Group[] {
  const by = new Map<Key, Group>()
  const add = (key: Key, item: ItemRef | null, u: Under) => {
    const g = by.get(key) ?? { key, item, list: [] }
    g.list.push(u)
    by.set(key, g)
  }
  for (const e of list) {
    const o = e.out
    if (pending(o)) add('pending', null, { e, how: null, also: [] })
    else if (o.k === 'filed') for (const x of o.items) add(`item ${x.item.n}`, x.item, { e, how: x.did === 'Created' ? 'Created' : 'Added', also: o.items.filter((y) => y !== x).map((y) => y.item) })
    else if (o.k === 'answer') add(`item ${o.item.n}`, o.item, { e, how: 'Answer', also: [] })
    else add(o.k as 'agent' | 'handled' | 'moved', null, { e, how: null, also: [] })
  }
  // what Taska has not placed yet first; then by the latest input in each, newest first (the list comes newest first)
  const sorted = [...by.values()].sort((a, b) => (a.key === 'pending' ? -1 : b.key === 'pending' ? 1 : list.indexOf(a.list[0].e) - list.indexOf(b.list[0].e)))
  const seen = new Map<string, ItemRef | null>()
  for (const g of sorted)
    for (const u of g.list) {
      u.again = seen.has(u.e.r.id)
      if (u.again) u.fullIn = seen.get(u.e.r.id)
      else seen.set(u.e.r.id, g.item)
    }
  return sorted
}

function GroupHead({ g, desk }: { g: Group; desk: boolean }) {
  const n = <span className="ml-auto shrink-0 pl-3 text-[13px] leading-6 whitespace-nowrap text-zinc-400 tabular-nums">{plural(g.list.length, 'input')}</span>
  const pad = desk ? 'px-3' : 'px-4'
  if (g.item) {
    const it = g.item
    return (
      <button className={`flex w-full items-start gap-2 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/70 ${pad}`}>
        <StateIcon {...it.status} cls="mt-0.5 size-5 shrink-0" />
        <span className="min-w-0 text-[15px] leading-6">
          <span className={`mr-1.5 font-mono text-sm font-bold ${TYPE_TEXT[it.type]}`}>{it.code}</span>
          <span className="font-semibold">{it.title}</span>
          <span className="text-[13px] whitespace-nowrap text-zinc-500 dark:text-zinc-400"> · {it.status.label}</span>
        </span>
        <span className="ml-auto">{n}</span>
      </button>
    )
  }
  const l = LABEL[g.key as keyof typeof LABEL]
  return (
    <div className={`flex items-center gap-2 py-2.5 text-[15px] leading-6 font-semibold ${pad}`}>
      <span className="grid size-5 shrink-0 place-items-center text-zinc-500 dark:text-zinc-400">
        <Icon n={l.icon} c="size-4" sw="2" />
      </span>
      {l.text}
      {n}
    </div>
  )
}

function Row({ u, g, desk, words, opened, toggle }: { u: Under; g: Group; desk: boolean; words: readonly string[]; opened: boolean; toggle(): void }) {
  const { e } = u
  const o = e.out
  // under an item: how it went in (after a dot); not placed yet: where it stands (its own mark leads it); the other
  // groups say it in their heads
  const how: ReactNode = u.how ? (
    <>
      <span className="text-zinc-300 dark:text-zinc-600">·</span>
      <span className="text-zinc-500 dark:text-zinc-400">{u.how}</span>
    </>
  ) : g.key === 'pending' ? (
    <State o={o} />
  ) : null
  const next = o.k === 'failed' || o.k === 'undone'
  return (
    <li className={`group/row relative py-2.5 ${desk ? 'pr-3 pl-4' : 'pr-4 pl-4'}`}>
      <div className="flex min-h-6 items-center gap-2 text-[13px]">
        <span className="shrink-0 font-mono font-bold text-zinc-900 dark:text-zinc-100">{e.code}</span>
        <span className="shrink-0 text-zinc-500 tabular-nums dark:text-zinc-400">{e.when}</span>
        {how ? <span className="flex min-w-0 items-center gap-2">{how}</span> : null}
        {desk ? null : <span className="ml-auto flex">{<Acts e={e} desk={false} />}</span>}
      </div>
      {u.again ? (
        <p className="mt-1 max-w-[42rem] truncate text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">{e.r.text}</p>
      ) : (
        <Words e={e} words={words} opened={opened} toggle={toggle} upTo="max-h-18" cls="mt-1 max-w-[42rem] text-[15px] leading-6" />
      )}
      {e.r.files.length && !u.again ? (
        <div className="mt-2">
          <Files r={e.r} size="size-14" />
        </div>
      ) : null}
      {o.k === 'moved' ? (
        <div className="mt-1.5">
          <State o={o} />
        </div>
      ) : null}
      {next ? (
        <div className="mt-1">
          <Next o={o} />
        </div>
      ) : null}
      {u.fullIn ? (
        <div className="mt-1.5 flex flex-col items-start gap-0.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">In full above, under</span>
          <ItemLink it={u.fullIn} />
        </div>
      ) : null}
      {u.also.some((it) => it.n !== u.fullIn?.n) ? (
        <div className={`flex flex-col items-start gap-0.5 ${u.fullIn ? 'mt-1.5' : 'mt-2.5'}`}>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Also {u.how === 'Created' ? 'created' : 'went into'}</span>
          {u.also
            .filter((it) => it.n !== u.fullIn?.n)
            .map((it) => (
              <ItemLink key={it.n} it={it} />
            ))}
        </div>
      ) : null}
      {desk ? <Acts e={e} desk /> : null}
    </li>
  )
}

export function ByWhatItBecame({ desk, q0 = '' }: { desk: boolean; q0?: string }) {
  const { q, setQ, words, list, total, opened, toggle } = useList(q0)
  const gs = groups(list)
  return (
    <div className="flex flex-col">
      <Head desk={desk} shown={list.length} total={total} q={q} setQ={setQ} />
      {gs.length ? (
        <div className={`flex flex-col ${desk ? 'gap-3' : 'gap-2 pb-6'}`}>
          {gs.map((g) => (
            <section key={g.key} className={desk ? 'overflow-hidden rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800' : 'border-y border-zinc-100 dark:border-zinc-800'}>
              <div className="bg-zinc-50 dark:bg-zinc-900">
                <GroupHead g={g} desk={desk} />
              </div>
              <ul className={`divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800 ${desk ? 'ml-[21px] border-l' : 'ml-[25px] border-l'}`}>
                {g.list.map((u) => (
                  <Row key={u.e.r.id} u={u} g={g} desk={desk} words={words} opened={opened.has(u.e.r.id)} toggle={() => toggle(u.e.r.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Nothing q={q} />
      )}
    </div>
  )
}
