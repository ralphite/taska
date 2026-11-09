// Beside a paragraph, on the desktop: speak a comment (Voice turns the two buttons into a recording strip there: ✕,
// ✓ into the box below, ↑ sent at once; B498) or write one (in the box below); each thread's count, level with the words it quotes and never on another, which opens its comments over the
// text; in a list each item is its own place to comment on (pointing at one puts the buttons beside it). Props only.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../ui/Icon'
import { PlaceVoice } from '../../ui/PlaceVoice'

export interface CountInfo {
  tk: string
  n: number
  done: boolean
  /** the words its thread quotes (where its count sits) */
  quote: string
  /** comments not sent yet (dashed, as their Not sent card) */
  draft?: boolean
}

export interface BlockActsEvents {
  say(quote: string | null): void
  comment(quote: string | null): void
  /** the recording strip's ✕, ✓ and ↑ */
  cancel(): void
  check(): void
  send(): void
  toggle(tk: string): void
  /** a click away from the open comments closes them */
  away(tk: string): void
}

/** How far down the paragraph the words a thread quotes start (an item of a list, or words inside the text). */
function quoteTop(sec: HTMLElement, quote: string): number {
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim()
  const q = norm(quote)
  const top = (r: DOMRect) => Math.round(r.top - sec.getBoundingClientRect().top)
  if (!q) return 0
  const li = [...sec.querySelectorAll<HTMLElement>('li')].find((l) => norm(l.innerText).includes(q))
  if (li) return top(li.getBoundingClientRect())
  const head = q.slice(0, 16)
  const w = document.createTreeWalker(sec.querySelector('[data-block]') || sec, NodeFilter.SHOW_TEXT)
  while (w.nextNode()) {
    const t = w.currentNode as Text
    const i = t.data.indexOf(head)
    if (i < 0) continue
    const r = document.createRange()
    r.setStart(t, i)
    r.setEnd(t, Math.min(t.data.length, i + head.length))
    return top(r.getBoundingClientRect())
  }
  return 0
}

export function BlockActs({ counts, open, rec, picked = false, meter, pointing = null, children, on }: {
  counts: CountInfo[]
  /** the thread whose comments are open over the text */
  open: string | null
  /** a voice comment is being recorded here: the buttons are its recording strip */
  rec: boolean
  /** the paragraph is picked: its buttons stay beside it */
  picked?: boolean
  /** the recording's time and level */
  meter?: ReactNode
  /** the item of a list the pointer is on when it opens (its place in the list) */
  pointing?: number | null
  /** the open comments */
  children?: ReactNode
  on: BlockActsEvents
}) {
  const box = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const btns = useRef(new Map<string, HTMLButtonElement>())
  const [at, setAt] = useState<{ top: number; quote: string } | null>(null)
  // recording, the strip stays where it began, wherever the pointer goes
  const still = useRef(rec)
  useLayoutEffect(() => {
    still.current = rec
  })
  useEffect(() => {
    // pointing at an item of a list: the buttons go beside it, and what you say quotes it
    const sec = box.current?.closest('section')
    if (!sec) return
    let lit: HTMLElement | null = null
    const light = (li: HTMLElement | null) => {
      if (lit === li) return
      lit?.removeAttribute('data-hov')
      li?.setAttribute('data-hov', '')
      lit = li
    }
    const move = (e: MouseEvent) => {
      if (still.current) return
      const li = (e.target as Element).closest<HTMLElement>('li')
      if (!li || !sec.contains(li) || box.current?.contains(li)) return // between items or on the buttons: it stays
      light(li)
      const top = Math.round(li.getBoundingClientRect().top - sec.getBoundingClientRect().top)
      setAt((a) => (a && a.top === top ? a : { top, quote: li.innerText.trim().slice(0, 500) }))
    }
    const leave = () => {
      if (still.current) return
      light(null)
      setAt(null)
    }
    sec.addEventListener('mousemove', move)
    sec.addEventListener('mouseleave', leave)
    const li = pointing == null ? null : sec.querySelectorAll<HTMLElement>('li')[pointing]
    if (li) {
      light(li)
      setAt({ top: Math.round(li.getBoundingClientRect().top - sec.getBoundingClientRect().top), quote: li.innerText.trim().slice(0, 500) })
    }
    return () => {
      sec.removeEventListener('mousemove', move)
      sec.removeEventListener('mouseleave', leave)
      light(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- where the pointer starts, once
  }, [])
  useLayoutEffect(() => {
    // each count level with its words, the next at least a row lower; the buttons where you point, never on a count
    const sec = box.current?.closest('section')
    if (!sec) return
    let last = -40
    const taken: number[] = []
    for (const c of counts) {
      last = Math.max(c.quote === '' ? 0 : quoteTop(sec, c.quote), last + 32)
      const b = btns.current.get(c.tk)
      if (b) b.style.top = last + 2 + 'px'
      if (c.tk === open && pop.current) pop.current.style.top = last + 36 + 'px'
      taken.push(last)
    }
    let y = at?.top ?? 0
    for (const top of taken) if (Math.abs(top - y) < 30) y = top + 32
    if (box.current) box.current.style.top = y + 2 + 'px'
  })
  useEffect(() => {
    // the open comments close on a click anywhere else, so they never sit over the paragraphs below
    if (!open) return
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      if (pop.current?.contains(t) || btns.current.get(open)?.contains(t)) return
      on.away(open)
    }
    document.addEventListener('mousedown', away, true)
    return () => document.removeEventListener('mousedown', away, true)
  }, [open, on])
  return (
    <>
      {counts.map((c) => (
        <button
          key={c.tk}
          data-thread-count={c.tk}
          ref={(el) => {
            if (el) btns.current.set(c.tk, el)
            else btns.current.delete(c.tk)
          }}
          onClick={() => on.toggle(c.tk)}
          className={`absolute left-[calc(100%+0.25rem)] z-10 flex h-7 min-w-7 items-center after:absolute after:-inset-2 justify-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold ${
            c.draft
              ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/60 dark:bg-amber-400/10 dark:text-amber-100 dark:hover:bg-amber-400/20'
              : c.done
                ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/70'
          }`}
        >
          {c.done ? <Icon n="check" c="size-3.5" /> : null}
          {c.n}
        </button>
      ))}
      {open && children ? (
        // over the text, ending at its edge: the counts beside the text stay in sight
        <div ref={pop} className="absolute right-0 z-20 flex w-80 max-w-full flex-col gap-2 text-sm shadow-xl">
          {children}
        </div>
      ) : null}
      {/* side by side, the voice first, beside the paragraph (its pointing area reaches over this column); speaking,
          the strip ends where they end and grows to the left, over the paragraph's first line (B498) */}
      <div ref={box} className={`absolute -right-16 z-10 justify-end ${rec || picked ? 'flex' : 'hidden group-hover/blk:flex'}`}>
        <PlaceVoice
          rec={rec}
          meter={meter}
          on={{ say: () => on.say(at?.quote ?? null), comment: () => on.comment(at?.quote ?? null), cancel: on.cancel, check: on.check, send: on.send }}
        />
      </div>
    </>
  )
}
