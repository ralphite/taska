// Help, laid out as the best docs sites lay out their pages (Stripe, Mintlify, VitePress, Docusaurus): on the desktop
// the topics in their groups on the left (the way back and a search above them), the topic in the middle (where it
// sits, its name, what it answers, its sections) with the topics before and after it at its end, and On this page on
// the right, its sections, the one you are reading marked. On the phone the topic fills the page and Topics opens
// every topic with the search. A search shows what it finds in place of the topic. Props only: Markdown comes drawn
// by `render`.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Kbd } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { HELP_GROUPS, HELP_TOPICS, topicParts, type HelpTopic } from './topics'

export interface HelpEvents {
  open(key: string): void
  href(key: string): string
  search(q: string): void
  back(): void
  /** the phone's list of topics, opened or closed */
  menu(open: boolean): void
}

export function HelpPage({ desk, topic, q, found, back, menu, render, place, on }: {
  desk: boolean
  topic: HelpTopic
  q: string
  /** what the search finds */
  found: HelpTopic[]
  /** where the way back goes */
  back: string
  /** the phone: its list of topics is open */
  menu: boolean
  /** Markdown, drawn */
  render(text: string): ReactNode
  place: string
  on: HelpEvents
}) {
  const parts = topicParts(topic.text)
  const scroller = useRef<HTMLDivElement>(null)
  const [reading, setReading] = useState<string | null>(null)
  // On this page marks the section at the top of the page as you scroll
  useEffect(() => {
    const el = scroller.current
    if (!el || !desk) return
    const look = () => {
      const top = el.getBoundingClientRect().top + 96
      const heads = [...el.querySelectorAll<HTMLElement>('h2[id]')]
      let at: string | null = heads[0]?.id ?? null
      for (const h of heads) if (h.getBoundingClientRect().top <= top) at = h.id
      setReading(at)
    }
    look()
    el.addEventListener('scroll', look, { passive: true })
    return () => el.removeEventListener('scroll', look)
  }, [desk, topic.key, q])

  const link = (t: HelpTopic, cls: string, inner: ReactNode) => (
    <a
      key={t.key}
      href={on.href(t.key)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return
        e.preventDefault()
        on.open(t.key)
      }}
      {...(t.key === topic.key && !q.trim() ? { 'aria-current': 'page' as const } : {})}
      className={cls}
    >
      {inner}
    </a>
  )
  const go = (id: string) => (e: { preventDefault(): void }) => {
    e.preventDefault()
    scroller.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const group = HELP_GROUPS.find((g) => g.topics.includes(topic))?.name ?? ''
  const at = HELP_TOPICS.indexOf(topic)
  const prev = HELP_TOPICS[at - 1]
  const next = HELP_TOPICS[at + 1]

  const searchBox = (
    <label className="flex h-9 items-center gap-2 rounded-lg bg-white px-2.5 ring-1 ring-zinc-200 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-zinc-900 dark:ring-zinc-700">
      <Icon n="search" c="size-4 shrink-0 text-zinc-400" />
      <input value={q} onChange={(e) => on.search(e.target.value)} type="search" placeholder="Search help" aria-label="Search help" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
    </label>
  )
  const nav = (
    <>
      {HELP_GROUPS.map((g) => (
        <div key={g.name} className="pt-5 first:pt-3">
          <h2 className="px-3 pb-1.5 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{g.name}</h2>
          <ul className="border-l border-zinc-200 dark:border-zinc-800">
            {g.topics.map((t) => (
              <li key={t.key}>
                {link(
                  t,
                  '-ml-px flex min-h-8 items-center border-l-2 border-transparent py-1 pr-2 pl-3 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 aria-[current=page]:border-blue-600 aria-[current=page]:font-medium aria-[current=page]:text-blue-700 max-lg:min-h-11 max-lg:text-[15px] dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100 dark:aria-[current=page]:border-blue-400 dark:aria-[current=page]:text-blue-300',
                  <span className="truncate">{t.title}</span>,
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
  const results = found.length ? (
    <ul className="flex flex-col gap-2">
      {found.map((t) => (
        <li key={t.key}>
          {link(
            t,
            'flex flex-col gap-0.5 rounded-xl px-4 py-3 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-900',
            <>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{HELP_GROUPS.find((g) => g.topics.includes(t))?.name}</span>
              <span className="text-[15px] font-medium">{t.title}</span>
              <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{t.about}</span>
            </>,
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-[15px] text-zinc-500 dark:text-zinc-400">Nothing in Help matches “{q.trim()}”.</p>
  )
  const pager =
    prev || next ? (
      <nav aria-label="More topics" className="mt-14 grid gap-3 border-t border-zinc-200 pt-6 sm:grid-cols-2 dark:border-zinc-800">
        {prev ? (
          link(
            prev,
            'flex min-w-0 flex-col items-start gap-0.5 rounded-xl px-4 py-3 ring-1 ring-zinc-200 hover:ring-blue-500 dark:ring-zinc-800 dark:hover:ring-blue-400',
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
        {next
          ? link(
              next,
              'flex min-w-0 flex-col items-end gap-0.5 rounded-xl px-4 py-3 text-right ring-1 ring-zinc-200 hover:ring-blue-500 dark:ring-zinc-800 dark:hover:ring-blue-400',
              <>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Next</span>
                <span className="flex max-w-full items-center gap-1 text-[15px] font-medium text-blue-600 dark:text-blue-400">
                  <span className="truncate">{next.title}</span>
                  <Icon n="right" c="size-4 shrink-0" />
                </span>
              </>,
            )
          : null}
      </nav>
    ) : null
  const article = (
    <article className="text-[15px] text-zinc-800 dark:text-zinc-200">
      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{group}</p>
      <h1 className="mt-1.5 text-[28px] leading-tight font-bold tracking-tight text-zinc-950 max-lg:text-2xl dark:text-white">{topic.title}</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-zinc-600 dark:text-zinc-400">{topic.about}</p>
      {parts.intro ? <div className="mt-6">{render(parts.intro)}</div> : null}
      {parts.sections.map((s) => (
        <section key={s.id}>
          <h2 id={s.id} className="group mt-10 flex scroll-mt-6 items-center gap-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {s.title}
            <a href={`#${s.id}`} onClick={go(s.id)} aria-label={`Link to ${s.title}`} className="text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-blue-600 focus-visible:opacity-100 dark:text-zinc-600">
              #
            </a>
          </h2>
          <div className="mt-3">{render(s.text)}</div>
        </section>
      ))}
      {pager}
    </article>
  )

  if (!desk) {
    return (
      <section data-part="help" aria-label="Help" className={`flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-900 ${place}`}>
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-200 px-1 dark:border-zinc-800">
          <button onClick={menu ? () => on.menu(false) : on.back} aria-label={menu ? 'Close topics' : 'Back'} className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 dark:text-zinc-400">
            <Icon n={menu ? 'x' : 'left'} c="size-6" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{menu ? 'Topics' : 'Help'}</h1>
          {menu ? null : (
            <button onClick={() => on.menu(true)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-blue-600 dark:text-blue-400">
              <Icon n="menu" c="size-5" />
              Topics
            </button>
          )}
        </header>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto outline-none overscroll-contain px-4 pb-12">
          {menu ? (
            <>
              <div className="pt-3">{searchBox}</div>
              {q.trim() ? <div className="pt-4">{results}</div> : nav}
            </>
          ) : (
            <div className="pt-5">{article}</div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section data-part="help" aria-label="Help" className={`flex min-h-0 flex-1 flex-row overflow-hidden bg-white dark:bg-zinc-900 ${place}`}>
      <nav aria-label="Help topics" className="flex w-64 shrink-0 flex-col overflow-y-auto outline-none overscroll-contain border-r border-zinc-200 px-3 pb-6 lg:scrollbar-thin dark:border-zinc-800">
        <div className="flex h-14 shrink-0 items-center">
          <button onClick={on.back} className="-ml-1 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <Icon n="left" c="size-4" />
            Back to {back}
            <Kbd k="Esc" />
          </button>
        </div>
        <p className="px-1 pb-3 text-[17px] font-semibold tracking-tight">Help</p>
        {searchBox}
        {nav}
      </nav>
      <div ref={scroller} className="min-w-0 flex-1 overflow-y-auto outline-none overscroll-contain lg:scrollbar-gutter-both">
        <div className="mx-auto flex w-full max-w-[64rem] gap-12 px-10 pt-10 pb-16">
          <div className="min-w-0 max-w-[44rem] flex-1">
            {q.trim() ? (
              <>
                <h1 className="pb-5 text-2xl font-bold tracking-tight">Search results</h1>
                {results}
              </>
            ) : (
              article
            )}
          </div>
          {!q.trim() && parts.sections.length ? (
            <aside aria-label="On this page" className="sticky top-10 hidden w-52 shrink-0 self-start xl:block">
              <p className="pb-2 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">On this page</p>
              <ul className="border-l border-zinc-200 dark:border-zinc-800">
                {parts.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={go(s.id)}
                      {...(reading === s.id ? { 'aria-current': 'location' as const } : {})}
                      className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-[13px] text-zinc-500 hover:text-zinc-900 aria-[current=location]:border-blue-600 aria-[current=location]:font-medium aria-[current=location]:text-blue-700 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-[current=location]:border-blue-400 dark:aria-[current=location]:text-blue-300"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  )
}
