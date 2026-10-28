// The change log's lines: one change as a sentence (who, then what, its codes as links), and the end of what is
// loaded, which asks for the changes before it as it comes near. Props only.

import { useEffect, useRef } from 'react'
import type { LogSentence } from '../model/activity'

export interface LogEvents {
  item(n: number): void
  input(id: string): void
}

/** One change as a sentence: who, then what, its codes as links; the time in grey when asked for. */
export function LogLine({ s, withTime = false, on }: { s: LogSentence; withTime?: boolean; on: LogEvents }) {
  // the spaces go with the words beside them, one run of text each, as the words are set
  const parts: LogSentence['parts'] = []
  for (const p of [' ', ...s.parts, ...(withTime ? [' '] : [])]) {
    const last = parts.at(-1)
    if (typeof p === 'string' && typeof last === 'string') parts[parts.length - 1] = last + p
    else parts.push(p)
  }
  return (
    <>
      <span className="font-medium text-zinc-800 dark:text-zinc-100">{s.who}</span>
      {s.session ? (
        <>
          {' '}
          <span className="text-zinc-500 dark:text-zinc-400">{'· ' + s.session}</span>
        </>
      ) : null}
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : 'n' in p ? (
          <button key={i} onClick={() => on.item(p.n)} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {p.code}
          </button>
        ) : (
          <button key={i} onClick={() => on.input(p.id)} className="font-mono text-blue-600 hover:underline dark:text-blue-400">
            {p.code}
          </button>
        ),
      )}
      {withTime ? <span className="font-mono text-[11px] whitespace-nowrap text-zinc-400">{s.time}</span> : null}
    </>
  )
}

/** The end of what is loaded: when it comes near, the changes before load. */
export function LogMore({ end, cls, onNear }: { end: boolean; cls: string; onNear(): void }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || end || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && onNear(), { root: el.closest('.overflow-y-auto'), rootMargin: '0px 0px 600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  })
  return (
    <p ref={ref} className={`text-[13px] text-zinc-400 dark:text-zinc-500 ${cls}`}>
      {end ? 'No earlier changes' : 'Loading…'}
    </p>
  )
}
