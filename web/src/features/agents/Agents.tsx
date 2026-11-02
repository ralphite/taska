// What the agent pill opens: whether an agent is around and what waits for one, who has been here (once one has),
// how to connect one more, and what an agent reads (its guide, laid out: its parts, its commands beside what they
// do, its example). Props only.

import type { ReactNode } from 'react'
import { guideParts, type GuidePart } from '../../model/guide'
import { plural } from '../../model/words'
import { Avatar } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import type { SheetParts } from '../../ui/Sheet'
import { CHIP } from '../../ui/tones'

export interface AgentsFacts {
  tone: 'ok' | 'bad' | 'idle'
  line: string
  queue: number
  later: number
  seen: { name: string; who: string; when: string; known: boolean }[]
  cmd: string
  far: string
  ask: string
  guide: string | null
}

const CARD_LOOK = {
  bad: ['bg-red-50 dark:bg-red-400/10', 'bg-red-500 ring-4 ring-red-500/20 dark:bg-red-400', 'text-red-800 dark:text-red-200', 'text-red-700/80 dark:text-red-300/80'],
  ok: ['bg-emerald-50 dark:bg-emerald-400/10', 'bg-emerald-500 ring-4 ring-emerald-500/20 dark:bg-emerald-400', 'text-emerald-900 dark:text-emerald-100', 'text-emerald-800/80 dark:text-emerald-300/80'],
  idle: ['bg-zinc-100 dark:bg-zinc-800', 'bg-zinc-400 ring-4 ring-zinc-400/20', 'text-zinc-800 dark:text-zinc-100', 'text-zinc-500 dark:text-zinc-400'],
} as const

const CARD = 'rounded-2xl border border-zinc-200 dark:border-zinc-800'
const CODE = 'rounded bg-zinc-100 px-1 font-mono text-[12.5px] dark:bg-zinc-800'

/** The Agents sheet (`guideOpen`: what the agent reads shown, as after a click on it). */
export function agentsSheet(f: AgentsFacts, on: { copy(text: string): void; help(): void }, guideOpen = false): SheetParts {
  return { title: 'Agents', body: <AgentsBody f={f} on={on} guideOpen={guideOpen} /> }
}

function AgentsBody({ f, on, guideOpen }: { f: AgentsFacts; on: { copy(text: string): void; help(): void }; guideOpen: boolean }) {
  const onCopy = on.copy
  const look = CARD_LOOK[f.tone]
  const way = (icon: IconName, title: string, copy: string, body: ReactNode) => (
    <section className={`${CARD} flex min-w-0 flex-col`}>
      <header className="flex h-12 items-center gap-2 border-b border-zinc-200 pr-2 pl-4 dark:border-zinc-800">
        <Icon n={icon} c="size-4 text-zinc-500 dark:text-zinc-400" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{title}</h3>
        <button onClick={() => onCopy(copy)} className={`${CHIP} font-medium`}>
          <Icon n="copy" c="size-3.5" />
          Copy
        </button>
      </header>
      <div className="flex flex-col gap-2.5 p-4 text-sm">{body}</div>
    </section>
  )
  return (
    <div className="flex flex-col gap-8 px-1 pt-1 pb-2">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className={`flex gap-3 rounded-2xl p-4 ${look[0]}`}>
          <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${look[1]}`} />
          <div>
            <p className={`text-[15px] leading-snug font-semibold ${look[2]}`}>{f.line}</p>
            <p className={`mt-1 text-[13px] leading-snug ${look[3]}`}>
              {plural(f.queue, 'item')} in the queue{f.later ? ` (${f.later} later)` : ''}
            </p>
          </div>
        </div>
        {f.seen.length ? (
          <section className={`${CARD} px-4 py-3`}>
            <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Seen in this project</h3>
            <ul className="mt-1">
              {f.seen.map((a) => (
                <li key={a.name} className={`flex h-9 items-center gap-2.5 text-sm ${a.known ? '' : 'opacity-55'}`}>
                  <Avatar by={a.name} />
                  <span className="min-w-0 flex-1 truncate">{a.who}</span>
                  <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{a.when}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Connect an agent</h2>
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          When you write, Taska tells the connected agent at once; waiting costs no tokens. Agents never poll or set timers.{' '}
          <button onClick={on.help} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            How it works
          </button>
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {way(
            'terminal',
            'Run a command',
            f.cmd,
            <>
              <p className="text-zinc-500 dark:text-zinc-400">Once per machine, in the project folder.</p>
              <code className="font-mono text-[13px] leading-relaxed break-words">{f.cmd}</code>
              {f.far ? (
                <p className="text-zinc-500 dark:text-zinc-400">
                  <button onClick={() => onCopy(f.far)} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    Copy for another network
                  </button>
                </p>
              ) : null}
            </>,
          )}
          {way(
            'comment',
            'Or tell the agent',
            f.ask,
            <>
              <p className="leading-relaxed break-words">{f.ask.replace(/`/g, '')}</p>
            </>,
          )}
        </div>
      </section>
      <details open={guideOpen} className={`${CARD} group px-4`}>
        <summary className="flex min-h-12 cursor-pointer items-center gap-1.5 text-sm font-semibold hover:text-zinc-600 dark:hover:text-zinc-300">
          <Icon n="right" c="size-4 text-zinc-400 transition-transform group-open:rotate-90" />
          What the agent reads
        </summary>
        {f.guide ? <Guide text={f.guide} /> : <p className="pb-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}
      </details>
    </div>
  )
}

/** Words with `code` in them. */
function Words({ text }: { text: string }) {
  return <>{text.split('`').map((s, i) => (i % 2 ? <code key={i} className={CODE}>{s}</code> : s))}</>
}

function Part({ p }: { p: GuidePart }) {
  switch (p.kind) {
    case 'heading':
      return (
        <h3 className="pt-3 text-sm font-semibold first:pt-0">
          {p.text}
          {p.note ? <span className="font-normal text-zinc-500 dark:text-zinc-400"> {p.note}</span> : null}
        </h3>
      )
    case 'text':
      return (
        <p className="text-sm leading-relaxed wrap-anywhere text-zinc-700 dark:text-zinc-300">
          <Words text={p.text} />
        </p>
      )
    case 'rows':
      return (
        <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {p.rows.map((r, i) => (
            <div key={i} className="grid gap-1 py-2 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4">
              <dt className="font-mono text-[12.5px] leading-5 break-words whitespace-pre-wrap">{r.cmd}</dt>
              <dd className="text-sm leading-5 wrap-anywhere text-zinc-600 dark:text-zinc-400">
                <Words text={r.say} />
              </dd>
            </div>
          ))}
        </dl>
      )
    case 'code':
      return <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-[12.5px] leading-relaxed wrap-anywhere whitespace-pre-wrap lg:scrollbar-thin dark:bg-zinc-800">{p.text}</pre>
  }
}

/** The guide agents read, laid out; its words are the agents', word for word. */
function Guide({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      {guideParts(text).map((p, i) => (
        <Part key={i} p={p} />
      ))}
    </div>
  )
}
