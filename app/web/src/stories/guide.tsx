// The guide through a prototype (R488, B524): each step says what it does and what to tap; a big blue mark spreads
// out on that part, wherever it is now; a tap on it moves on (it never plays itself; any other tap just does what it
// does); the step is said under the screen, with Start again. And how loud you speak while it listens. Used by the
// prototypes.
import { useLayoutEffect, useState, type RefObject } from 'react'

/** A step of the way through: what it does, and what to tap (found in the screen). */
export interface Step {
  say: string
  tap(root: HTMLElement): Element | null
}
export const sel = (q: string) => (root: HTMLElement) => root.querySelector(q)
export const withText = (q: string, text: string) => (root: HTMLElement) => [...root.querySelectorAll(q)].find((e) => e.textContent?.includes(text)) || null

/** A big mark where to tap next, spreading out (R488): on the part the step names, wherever it is now. */
export function Mark({ root, step }: { root: RefObject<HTMLDivElement | null>; step: Step | null }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const find = () => {
      const r = root.current
      const el = r && step ? step.tap(r) : null
      if (!r || !el) return setAt(null)
      const a = r.getBoundingClientRect()
      const b = el.getBoundingClientRect()
      setAt({ x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 })
    }
    find()
    const t = setInterval(find, 250)
    return () => clearInterval(t)
  }, [root, step])
  return at ? (
    <span className="pointer-events-none absolute z-40 size-14 -translate-x-1/2 -translate-y-1/2" style={{ left: at.x, top: at.y }}>
      <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/30" />
      <span className="absolute inset-0 rounded-full border-4 border-blue-500" />
    </span>
  ) : null
}

// ---------------------------------------------------------------- the screen


/** What the step does, under the screen and apart from it (R488), and Start again. */
export function GuideLine({ n, total, say, onAgain }: { n: number; total: number; say: string | undefined; onAgain(): void }) {
  return (
    <>
      <p className="flex min-h-10 items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
        <span className="font-mono text-xs text-zinc-400">
          {Math.min(n + 1, total)} / {total}
        </span>
        <span className="flex-1">{say ?? 'That is all of it: tap anything, or start again.'}</span>
      </p>
      <button onClick={onAgain} className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30">
        Start again
      </button>
    </>
  )
}

/** How loud you speak, as the box's recording bar draws it. */
export const Level = () => (
  <span className="flex h-8 items-center gap-1">
    {[0.3, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.3, 0.5].map((h, i) => (
      <span key={i} className="w-1 rounded-full bg-red-500 dark:bg-red-400" style={{ height: `${h * 100}%` }} />
    ))}
  </span>
)
