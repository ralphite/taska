// Shared guide parts for prototypes: find a target by its role, name or words, mark where to tap, describe the step
// below the screen, and show a simulated microphone level. Each prototype owns its steps and transitions.
import { useLayoutEffect, useState, type RefObject } from 'react'

/** What to tap: a part by its role and name (as a screen reader finds it), by its words, by a CSS selector, or found
 * by a function of the screen. */
export type Target = string | { role?: string; name?: string | RegExp; text?: string } | ((root: HTMLElement) => Element | null)

/** A step of the way through: what it does, what to tap, and what the screen shows once it is done. */
export interface Step {
  say: string
  tap?: Target
  /** done when this is true of the screen (else: once its part is tapped) */
  until?(root: HTMLElement): boolean
}

const ROLE: Record<string, string> = { button: 'button, [role="button"]', link: 'a[href], [role="link"]', tab: '[role="tab"]', textbox: 'textarea, input, [role="textbox"]' }
const nameOf = (e: Element) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim()
const shown = (e: Element) => {
  const r = e.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
}

/** The part a target names on the screen, if it is there and shown. */
export function find(root: HTMLElement, t: Target | undefined): Element | null {
  if (!t) return null
  if (typeof t === 'function') return t(root)
  if (typeof t === 'string') return [...root.querySelectorAll(t)].find(shown) ?? null
  const all = [...root.querySelectorAll(t.role ? ROLE[t.role] || `[role="${t.role}"]` : '*')].filter(shown)
  const match = (e: Element) => {
    const n = nameOf(e)
    if (t.name instanceof RegExp) return t.name.test(n)
    if (t.name != null) return n === t.name || n.startsWith(t.name)
    return !!t.text && n.includes(t.text)
  }
  // by its words: the smallest part that has them
  const hits = all.filter(match)
  return t.role ? (hits[0] ?? null) : (hits.find((e) => !hits.some((o) => o !== e && e.contains(o))) ?? null)
}
export const sel = (q: string): Target => q
export const withText = (q: string, text: string): Target => (root) => [...root.querySelectorAll(q)].find((e) => shown(e) && e.textContent?.includes(text)) || null

/** Where to tap next, drawn so it is plainly not part of Taska (F566, r970): the screen dims, the part the step names
 * stays lit inside a thick yellow frame (a colour Taska itself never uses) with a yellow "Tap here" beside it. It is
 * there at once and follows the part wherever it goes; clicks pass through it. */
export function Mark({ root, step }: { root: RefObject<HTMLElement | null>; step: Step | null }) {
  const [at, setAt] = useState<{ x: number; y: number; w: number; h: number; side: 'right' | 'below' | 'above' } | null>(null)
  useLayoutEffect(() => {
    let raf = 0
    const follow = () => {
      const r = root.current
      const el = r && step ? find(r, step.tap) : null
      if (!r || !el) setAt((a) => (a ? null : a))
      else {
        const a = r.getBoundingClientRect()
        const b = el.getBoundingClientRect()
        const x = b.left - a.left - 6
        const w = b.width + 12
        // the label goes beside the part when there is room, else under it (over it near the bottom)
        const side = x + w + 110 < a.width ? 'right' : b.top - a.top < a.height / 2 ? 'below' : 'above'
        const n = { x, y: b.top - a.top - 6, w, h: b.height + 12, side } as const
        setAt((p) => (p && p.side === n.side && Math.abs(p.x - n.x) < 0.5 && Math.abs(p.y - n.y) < 0.5 && Math.abs(p.w - n.w) < 0.5 && Math.abs(p.h - n.h) < 0.5 ? p : n))
      }
      raf = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(raf)
  }, [root, step])
  return at ? (
    <span data-guide-mark className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      <span className="absolute rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] ring-4 ring-yellow-300" style={{ left: at.x, top: at.y, width: at.w, height: at.h }}>
        <span className="absolute -inset-1.5 animate-pulse rounded-2xl ring-4 ring-yellow-300/60" />
      </span>
      <span
        className="absolute rounded-full bg-yellow-300 px-3 py-1 text-sm font-bold whitespace-nowrap text-black shadow-lg"
        style={at.side === 'right' ? { left: at.x + at.w + 10, top: at.y + at.h / 2 - 14 } : { left: Math.max(8, at.x + at.w / 2 - 44), top: at.side === 'below' ? at.y + at.h + 10 : at.y - 40 }}
      >
        Tap here
      </span>
    </span>
  ) : null
}

/** What the step does, under the screen and apart from it (R488), whether its part is missing, and Start again. */
export function GuideLine({ n, total, say, missing = false, onAgain }: { n: number; total: number; say: string | undefined; missing?: boolean; onAgain(): void }) {
  return (
    <>
      <p className="flex min-h-10 items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
        <span className="font-mono text-xs text-zinc-400">
          {Math.min(n + 1, total)} / {total}
        </span>
        <span className="flex-1">{say ?? 'That is all of it: tap anything, or start again.'}</span>
      </p>
      {say && missing ? <p className="text-xs text-red-600 dark:text-red-400">Step {n + 1}: what to tap is not on the screen now.</p> : null}
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
