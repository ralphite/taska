// Help, as a Markdown docs site: on the desktop a column with the way back, a search and every topic in its group,
// and beside it the topic open (its group, name, what it answers, its words, and the topics before and after it); on
// the phone an index (the search over the groups) or one topic's page, plain like a page of a docs site. A search
// shows the topics it finds in place of the topic or the index. Props only: a topic's words come in drawn.

import type { ReactNode } from 'react'
import { Kbd } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { HELP_GROUPS, HELP_TOPICS, type HelpTopic } from './topics'

export interface HelpEvents {
  open(key: string): void
  href(key: string): string
  search(q: string): void
  back(): void
}

export function HelpPage({ desk, topic, q, found, back, body, place, on }: {
  desk: boolean
  /** the topic open (none: the phone's index) */
  topic: HelpTopic | null
  q: string
  /** what the search finds */
  found: HelpTopic[]
  /** where the way back goes */
  back: string
  /** the open topic's words */
  body: ReactNode
  place: string
  on: HelpEvents
}) {
  const link = (t: HelpTopic, cls: string, inner: ReactNode) => (
    <a
      key={t.key}
      href={on.href(t.key)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return
        e.preventDefault()
        on.open(t.key)
      }}
      {...(t.key === topic?.key ? { 'aria-current': 'page' as const } : {})}
      className={cls}
    >
      {inner}
    </a>
  )
  const searchBox = (
    <label className="flex h-9 items-center gap-2 rounded-lg bg-white px-2.5 ring-1 ring-zinc-200 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-zinc-900 dark:ring-zinc-700">
      <Icon n="search" c="size-4 shrink-0 text-zinc-400" />
      <input value={q} onChange={(e) => on.search(e.target.value)} type="search" placeholder="Search help" aria-label="Search help" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
    </label>
  )
  const results = (cls: string) =>
    found.length ? (
      <div className={cls}>
        {found.map((t) =>
          link(
            t,
            'flex flex-col gap-0.5 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
            <>
              <span className="text-[15px] font-medium">{t.title}</span>
              <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{t.about}</span>
            </>,
          ),
        )}
      </div>
    ) : (
      <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">Nothing in Help matches “{q.trim()}”.</p>
    )
  const at = topic ? HELP_TOPICS.indexOf(topic) : -1
  const prev = at > 0 ? HELP_TOPICS[at - 1] : undefined
  const next = at >= 0 ? HELP_TOPICS[at + 1] : undefined
  const group = topic ? HELP_GROUPS.find((g) => g.topics.includes(topic))?.name : ''
  // the topics before and after this one, side by side at its end, as docs sites have them
  const pager = (cls: string) =>
    prev || next ? (
      <nav aria-label="More topics" className={`grid gap-3 border-t sm:grid-cols-2 border-zinc-200 pt-5 dark:border-zinc-800 ${cls}`}>
        {prev ? (
          link(
            prev,
            'flex min-w-0 flex-col items-start gap-0.5 rounded-xl px-4 py-3 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-900',
            <>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Previous</span>
              <span className="flex max-w-full items-center gap-1 text-[15px] font-medium text-blue-600 dark:text-blue-400">
                <Icon n="left" c="size-4 shrink-0" />
                <span className="truncate">{prev.title}</span>
              </span>
            </>,
          )
        ) : (
          <span className="hidden sm:block" />
        )}
        {next ? (
          link(
            next,
            'flex min-w-0 flex-col items-end gap-0.5 rounded-xl px-4 py-3 text-right ring-1 ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-900',
            <>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Next</span>
              <span className="flex max-w-full items-center gap-1 text-[15px] font-medium text-blue-600 dark:text-blue-400">
                <span className="truncate">{next.title}</span>
                <Icon n="right" c="size-4 shrink-0" />
              </span>
            </>,
          )
        ) : null}
      </nav>
    ) : null
  const CARDS = 'divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800'

  if (!desk) {
    return (
      <section data-part="help" aria-label="Help" className={`flex min-h-0 flex-1 flex-col overflow-y-auto outline-none overscroll-contain pb-10 ${topic ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-100 dark:bg-zinc-950'} ${place}`}>
        <header className={`sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 px-1 backdrop-blur ${topic ? 'bg-white/90 dark:bg-zinc-900/90' : 'bg-zinc-100/90 dark:bg-zinc-950/90'}`}>
          <button onClick={on.back} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 dark:text-zinc-400">
            <Icon n="left" c="size-6" />
          </button>
          <h1 className="min-w-0 truncate text-[17px] font-semibold">{topic ? topic.title : 'Help'}</h1>
        </header>
        {topic ? (
          <article className="px-4 pt-1 text-[15px]">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{group}</p>
            <p className="mt-1 pb-4 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{topic.about}</p>
            {body}
            {pager('mt-10')}
          </article>
        ) : (
          <>
            <div className="px-3 pt-1">{searchBox}</div>
            {q.trim() ? (
              <div className="mt-4 px-3">{results(CARDS)}</div>
            ) : (
              HELP_GROUPS.map((g) => (
                <div key={g.name}>
                  <h2 className="px-5 pt-6 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{g.name}</h2>
                  <div className="mx-3 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                    {g.topics.map((t) =>
                      link(
                        t,
                        'flex min-h-12 items-center gap-3 px-3.5 py-2.5 text-[15px]',
                        <>
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                        </>,
                      ),
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </section>
    )
  }

  return (
    <section data-part="help" aria-label="Help" className={`flex min-h-0 flex-1 flex-row overflow-hidden ${place}`}>
      <nav aria-label="Help topics" className="flex w-64 shrink-0 flex-col overflow-y-auto outline-none overscroll-contain border-r border-zinc-200 pb-6 lg:scrollbar-thin dark:border-zinc-800">
        <div className="flex h-14 shrink-0 items-center px-2">
          <button onClick={on.back} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <Icon n="left" c="size-4" />
            Back to {back}
            <Kbd k="Esc" />
          </button>
        </div>
        <h1 className="px-4 pt-1 pb-3 text-[19px] font-semibold tracking-tight">Help</h1>
        <div className="px-3 pb-2">{searchBox}</div>
        {HELP_GROUPS.map((g) => (
          <div key={g.name} className="px-2 pt-4">
            <h2 className="px-2.5 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{g.name}</h2>
            {g.topics.map((t) =>
              link(
                t,
                'flex h-8 items-center rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-[current=page]:bg-blue-500/15 dark:aria-[current=page]:text-blue-300',
                <span className="truncate">{t.title}</span>,
              ),
            )}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto outline-none overscroll-contain lg:scrollbar-gutter-both">
        <div className="mx-auto w-full max-w-[46rem] px-8 pt-9 pb-16">
          {q.trim() ? (
            <>
              <h1 className="pb-5 text-[22px] leading-tight font-semibold tracking-tight">Search results</h1>
              {results(CARDS)}
            </>
          ) : topic ? (
            <article>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{group}</p>
              <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight">{topic.title}</h1>
              <p className="mt-2 pb-6 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{topic.about}</p>
              <div className="text-[15px]">{body}</div>
              {pager('mt-12')}
            </article>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** The page's keys, as the keys sheet has them, in a topic. */
export function KeyTable({ groups }: { groups: [string, [string, string][]][] }) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map(([name, rows]) => (
        <section key={name}>
          <h2 className="pb-2 text-sm font-semibold">{name}</h2>
          <dl className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200 dark:divide-zinc-800 dark:ring-zinc-800">
            {rows.map(([k, t]) => (
              <div key={k + t} className="flex items-baseline gap-4 px-4 py-2 text-sm">
                <dt className="w-40 shrink-0 font-mono text-[13px] text-zinc-700 dark:text-zinc-300">{k}</dt>
                <dd className="text-zinc-600 dark:text-zinc-400">{t}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
