// What the agent pill opens (F768, Yadong chose Gemini's "compact" design): under the title, whether an agent is
// around and what waits for one. On the left every agent session seen in the project, by its app, a manager's workers
// under it, each by its state's dot, its name and when it was last heard of; under them how to connect another agent
// and what agents read. On the right the session picked: its state and for how long, its app and folder, what it waits
// for you on, the item it is on, its workers, its last messages, and the way back to it in its app. The phone shows the
// list, then the session's page with Back. Props only.

import { useState, type ReactNode } from 'react'
import { plural, hasIcon, whoName } from '../../model/words'
import { Avatar, Who } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { SheetParts } from '../../ui/Sheet'
import { CHIP, MUTED, NEEDS_CARD, SECOND } from '../../ui/tones'
import type { AgentsFacts, ItemRef, SessionFacts, SessionState } from './agentsFacts'
import { AgentsGuide } from './AgentsGuide'

export interface AgentsActs {
  copy(text: string): void
  /** How it works (Help › Connect an agent) */
  help(): void
  /** an item, by its code */
  open(code: string): void
}

/** What shows when the sheet opens: the session picked (a key; 'guide': what agents read), whether the phone shows
 * its page rather than the list, whether Connect another agent is opened, whether Codex's resume command shows. */
export interface AgentsStart {
  pick?: string
  page?: boolean
  connect?: boolean
  resume?: boolean
}

const TONE = {
  bad: 'bg-red-500 dark:bg-red-400',
  ok: 'bg-emerald-500 dark:bg-emerald-400',
  idle: 'bg-zinc-400',
  blocked: 'bg-amber-500 dark:bg-amber-400',
} as const

const DOT: Record<SessionState, string> = {
  working: 'bg-emerald-500 dark:bg-emerald-400',
  idle: 'bg-zinc-400 dark:bg-zinc-500',
  waiting: 'bg-amber-500 dark:bg-amber-400',
  gone: 'border border-zinc-300 dark:border-zinc-600',
}

const PILL: Record<SessionState, string> = {
  working: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  idle: 'bg-zinc-100 text-zinc-600 ring-zinc-500/15 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/15',
  waiting: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/25',
  gone: 'bg-zinc-50 text-zinc-500 ring-zinc-500/10 dark:bg-zinc-800/60 dark:text-zinc-400 dark:ring-zinc-400/10',
}

const WORD: Record<SessionState, string> = { working: 'Working', idle: 'Idle', waiting: 'Waiting', gone: 'Gone' }
const AMBER = 'text-amber-700 dark:text-amber-400'
/** back to the session in its app: on the phone under its app and folder, the whole width; beside its name on the desktop */
const WAY_BACK = 'order-last mt-2 h-11 w-full basis-full rounded-xl text-[15px] lg:order-none lg:mt-0 lg:h-9 lg:w-auto lg:basis-auto lg:rounded-lg lg:px-3 lg:text-[13px]'
const LABEL = 'text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400'
const CODE = 'shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11.5px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
const ROW_HOVER = 'hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
/** the session shown beside the list (the phone shows one at a time: nothing is marked there) */
const PICKED = 'lg:bg-white lg:font-medium lg:shadow-sm lg:ring-1 lg:ring-zinc-200 lg:hover:bg-white dark:lg:bg-zinc-800 dark:lg:ring-zinc-700 dark:lg:hover:bg-zinc-800'

const Dot = ({ state }: { state: SessionState }) => <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[state]}`} />

/** A sentence that names an agent: the name drawn by the agent's app icon where it has one (T711). */
function Said({ text, by }: { text: string; by?: string }) {
  const name = by && hasIcon(by) ? whoName(by) : ''
  const at = name ? text.indexOf(name) : -1
  if (!by || at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <Who by={by} />
      {text.slice(at + name.length)}
    </>
  )
}

/** The Agents sheet; `start`: what shows when it opens (the stories show each). */
export function agentsSheet(f: AgentsFacts, on: AgentsActs, start: AgentsStart = {}): SheetParts {
  return {
    title: 'Agents',
    sub: (
      <p className="flex items-start gap-2 px-5 pb-3 text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">
        <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[f.tone]}`} />
        <span>
          <Said text={f.line} by={f.lineBy} /> <span className={MUTED}>{`${plural(f.queue, 'item')} in the queue${f.later ? ` (${f.later} later)` : ''}`}</span>
        </span>
      </p>
    ),
    body: <AgentsBody f={f} on={on} start={start} />,
  }
}

function AgentsBody({ f, on, start }: { f: AgentsFacts; on: AgentsActs; start: AgentsStart }) {
  const all = f.groups.flatMap((g) => g.sessions)
  const [pick, setPick] = useState(start.pick ?? f.start ?? 'guide')
  // the phone opens on a session waiting for you (the blocked bar's Open: what it waits on), else on the list
  const [page, setPage] = useState(start.page ?? all.some((x) => x.key === f.start && x.state === 'waiting'))
  const [connect, setConnect] = useState(start.connect ?? !all.length)
  const s = all.find((x) => x.key === pick) ?? (pick === 'guide' ? undefined : all.find((x) => x.key === f.start))
  const choose = (key: string) => {
    setPick(key)
    setPage(true)
  }
  return (
    <div className="flex flex-col border-t border-zinc-200 lg:-mx-4 lg:-mt-2 lg:-mb-5 lg:h-[calc(100%+1.75rem)] lg:flex-row dark:border-zinc-800">
      <nav aria-label="Sessions" className={`${page ? 'hidden lg:flex' : 'flex'} min-h-0 shrink-0 flex-col pt-3 lg:w-72 lg:rounded-bl-3xl lg:border-r lg:border-zinc-200 lg:bg-zinc-50/70 lg:pt-4 dark:lg:border-zinc-800 dark:lg:bg-zinc-950/30`}>
        <div className="flex-1 lg:overflow-y-auto lg:px-2 lg:scrollbar-thin">
          {f.groups.length ? (
            f.groups.map((g) => (
              <section key={g.app} className="pb-4">
                <h3 className={`flex h-7 items-center gap-2 px-2 ${LABEL}`}>
                  <Avatar by={g.app} />
                  {g.name}
                </h3>
                <ul>
                  {g.sessions.map((x) => (
                    <li key={x.key}>
                      <ListRow s={x} picked={!!s && x.key === s.key} onPick={() => choose(x.key)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className={`px-2 pb-4 text-sm ${MUTED}`}>No agent yet</p>
          )}
        </div>
        <div className="border-t border-zinc-200 py-1 lg:px-2 dark:border-zinc-800">
          <button onClick={() => setConnect(!connect)} aria-expanded={connect} className={`flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium ${ROW_HOVER}`}>
            <span className="min-w-0 flex-1">Connect another agent</span>
            <Icon n="down" c={`size-4 text-zinc-400 transition-transform ${connect ? 'rotate-180' : ''}`} />
          </button>
          {connect ? <Connect f={f} on={on} /> : null}
          <button
            onClick={() => choose('guide')}
            aria-current={!s ? 'true' : undefined}
            className={`flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium ${ROW_HOVER} ${!s ? PICKED : ''}`}
          >
            <span className="min-w-0 flex-1">What agents read</span>
            <Icon n="right" c="size-4 text-zinc-400" />
          </button>
        </div>
      </nav>
      <main className={`${page ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col pt-1 lg:overflow-y-auto lg:px-8 lg:pt-6 lg:pb-6 lg:scrollbar-thin`}>
        <button onClick={() => setPage(false)} className="-ml-1 flex h-10 w-fit items-center gap-1 rounded-lg pr-2 text-[15px] font-medium text-blue-600 lg:hidden dark:text-blue-400">
          <Icon n="left" c="size-5" />
          Agents
        </button>
        {s ? (
          <SessionPage key={s.key} s={s} on={on} onPick={(k) => setPick(k)} resume={!!start.resume} />
        ) : (
          <section className="flex flex-col gap-3 pt-2 lg:pt-0">
            <h3 className="text-xl font-semibold">What agents read</h3>
            <AgentsGuide text={f.guide} />
          </section>
        )}
      </main>
    </div>
  )
}

function ListRow({ s, picked, onPick }: { s: SessionFacts; picked: boolean; onPick(): void }) {
  return (
    <button
      onClick={onPick}
      aria-current={picked ? 'true' : undefined}
      className={`flex h-10 w-full items-center gap-2.5 rounded-lg pr-2 text-left text-sm lg:h-8 ${s.worker ? 'pl-7' : 'pl-2.5'} ${ROW_HOVER} ${picked ? PICKED : ''}`}
    >
      <Dot state={s.state} />
      <span className={`min-w-0 flex-1 truncate ${s.state === 'gone' ? 'text-zinc-500 dark:text-zinc-400' : ''}`}>{s.name}</span>
      <span className={`shrink-0 text-xs tabular-nums ${s.state === 'waiting' ? `font-medium ${AMBER}` : MUTED}`}>{s.state === 'waiting' ? 'Waiting' : s.when}</span>
    </button>
  )
}

/** The two ways to connect one more agent, each to copy: a command (and the one for another network), or words for
 * the agent. */
function Connect({ f, on }: { f: AgentsFacts; on: AgentsActs }) {
  const way = (title: string, text: ReactNode, copy: string, more?: ReactNode) => (
    <div className="flex flex-col gap-1.5 rounded-lg bg-zinc-100/80 p-2.5 dark:bg-zinc-800/60">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">{title}</span>
        <button onClick={() => on.copy(copy)} className={`${CHIP} h-7 bg-white px-2 text-xs font-medium dark:bg-zinc-700`}>
          <Icon n="copy" c="size-3.5" />
          Copy
        </button>
      </div>
      {text}
      {more}
    </div>
  )
  return (
    <div className="flex flex-col gap-2 px-2 pb-2">
      {way(
        'Run a command',
        <code className="font-mono text-[11.5px] leading-snug wrap-anywhere text-zinc-700 dark:text-zinc-300">{f.cmd}</code>,
        f.cmd,
        f.far ? (
          <button onClick={() => on.copy(f.far)} className="w-fit text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
            Copy for another network
          </button>
        ) : null,
      )}
      {way('Or tell the agent', <p className="text-xs leading-relaxed wrap-anywhere text-zinc-700 dark:text-zinc-300">{f.ask.replace(/`/g, '')}</p>, f.ask)}
      <button onClick={on.help} className="w-fit px-0.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
        How it works
      </button>
    </div>
  )
}

function ItemButton({ item, on, cls = '' }: { item: ItemRef; on: AgentsActs; cls?: string }) {
  return (
    <button onClick={() => on.open(item.code)} className={`flex min-w-0 items-center gap-2.5 text-left ${cls}`}>
      <span className={CODE}>{item.code}</span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
    </button>
  )
}

function SessionPage({ s, on, onPick, resume }: { s: SessionFacts; on: AgentsActs; onPick(key: string): void; resume: boolean }) {
  const [shown, setShown] = useState(resume)
  return (
    <article className="flex flex-col gap-6 pt-2 pb-4 lg:pt-0">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="min-w-0 text-xl font-semibold break-words">{s.name}</h3>
          {s.waits ? null : (
            <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ${PILL[s.state]}`}>
              <Dot state={s.state} />
              {s.pill}
            </span>
          )}
          <span className="hidden flex-1 lg:block" />
          {s.link?.kind === 'open' ? (
            <a href={s.link.href} className={`${SECOND} ${WAY_BACK}`}>
              Open in Claude Code
              <Icon n="open" c="size-4" />
            </a>
          ) : s.link?.kind === 'resume' ? (
            <button onClick={() => setShown(!shown)} aria-expanded={shown} className={`${SECOND} ${WAY_BACK}`}>
              <Icon n="terminal" c="size-4" />
              Resume
            </button>
          ) : null}
        <p className={`flex basis-full flex-wrap items-center gap-x-4 gap-y-1 text-[13px] ${MUTED}`}>
          <span className="flex items-center gap-1.5">
            <Avatar by={s.app} />
            {whoName(s.app)}
          </span>
          {s.folder ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon n="folder" c="size-4" />
              <span className="min-w-0 truncate font-mono text-xs">{s.folder}</span>
            </span>
          ) : null}
        </p>
        {shown && s.link?.kind === 'resume' ? (
          <div className="order-last mt-1 flex basis-full items-center gap-2 rounded-lg bg-zinc-100 py-1.5 pr-1.5 pl-3 dark:bg-zinc-800">
            <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all">{s.link.cmd}</code>
            <button onClick={() => s.link?.kind === 'resume' && on.copy(s.link.cmd)} className={`${CHIP} h-7 bg-white px-2 text-xs font-medium dark:bg-zinc-700`}>
              <Icon n="copy" c="size-3.5" />
              Copy
            </button>
          </div>
        ) : null}
      </header>
      {s.waits ? (
        <section className={`${NEEDS_CARD} flex flex-col gap-1 px-4 py-3`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <Dot state="waiting" />
            Waiting for you
            {s.waits.for ? <span className="font-normal text-amber-800/80 tabular-nums dark:text-amber-300/80">· {s.waits.for}</span> : null}
          </p>
          {s.waits.what ? <p className="pl-4 text-sm break-words text-amber-900/90 dark:text-amber-100/90">{s.waits.what}</p> : null}
        </section>
      ) : null}
      {s.on ? (
        <section className="flex flex-col gap-2">
          <h4 className={LABEL}>On now</h4>
          <ItemButton item={s.on} on={on} cls={`rounded-xl border border-zinc-200 px-3.5 py-3 text-sm font-medium ${ROW_HOVER} dark:border-zinc-800`} />
        </section>
      ) : null}
      {s.workers.length ? (
        <section className="flex flex-col gap-2">
          <h4 className={LABEL}>Workers</h4>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {s.workers.map((w) => (
              <li key={w.key} className="flex min-h-11 items-center gap-3 px-3.5 text-sm">
                <button onClick={() => onPick(w.key)} className="flex shrink-0 items-center gap-2.5 font-medium hover:underline">
                  <Dot state={w.state} />
                  {w.name}
                </button>
                {w.on ? <ItemButton item={w.on} on={on} cls="flex-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100" /> : <span className="flex-1" />}
                <span className={`shrink-0 text-xs ${w.state === 'working' ? 'text-emerald-700 dark:text-emerald-400' : w.state === 'waiting' ? AMBER : MUTED}`}>{WORD[w.state]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {s.activity.length ? (
        <section className="flex flex-col gap-1">
          <h4 className={`pb-1 ${LABEL}`}>Recent</h4>
          {s.activity.map((a) => (
            <button key={a.id} onClick={() => on.open(a.item.code)} className={`-mx-2 flex min-h-9 items-center gap-3 rounded-lg px-2 text-left text-[13px] ${ROW_HOVER}`}>
              <span className={`w-7 shrink-0 tabular-nums ${MUTED}`}>{a.when}</span>
              <span className={CODE}>{a.item.code}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{a.text}</span>
            </button>
          ))}
        </section>
      ) : null}
    </article>
  )
}
