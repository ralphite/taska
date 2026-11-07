// A guided tour through a story (F566, D105): one config per tour, the steps in order. Each step says what to do,
// names the part to tap (by its role and name, as a screen reader finds it, or by a data-* mark the page already has;
// never a mark added for tours) and, when tapping it is not the whole of it, what the screen shows once it is done.
// TourFrame draws it; engine.ts decides which step it is on.

/** The part a step points at: a role and a name, or a mark the page already has, inside another part, the nth one. */
export interface Target {
  /** a screen reader's role: button, link, tab, textbox, or any role="…" */
  role?: string
  /** its name (aria-label, else its words): a string matches the whole name, else its start; a RegExp anywhere */
  name?: string | RegExp
  /** a mark the page already has, as a CSS selector (`[data-n="12"]`) */
  css?: string
  within?: Target
  /** the nth of those found (0: the first) */
  nth?: number
  /** what it is called when it is not on the screen, in a word or two ("Stop and send") */
  label: string
}

/** What the screen shows once a step is done: a part there, a part gone (seen in this step, then gone), a part with
 * these words. */
export type Until = { shows: Target } | { gone: Target } | { hasText: Target; words: string }

/** One step: what to do, where to tap, when it is done. Without `until` it is done when its part is tapped; with
 * `next` it only shows something and is done when you tap Next. */
export interface Step {
  say: string
  target?: Target
  until?: Until
  next?: boolean
  /** how long to wait for its part before saying it is missing, in ms (3000) */
  wait?: number
  /** playing it (a Demo's Play): how long a person takes on this step before tapping, in ms (1200) */
  pace?: number
  /** playing it: swipe its part this way instead of tapping it (a row on the phone; give the step an `until`) */
  swipe?: 'left' | 'right'
  /** playing it: tap its part, then type these words into it (a text box; give the step an `until`) */
  type?: string
}

export interface Tour {
  steps: Step[]
}

type Opts = Partial<Pick<Target, 'within' | 'nth' | 'label'>>

/** A part by its role and its name. */
export const role = (r: string, name?: string | RegExp, o?: Opts): Target => ({
  role: r,
  name,
  within: o?.within,
  nth: o?.nth,
  label: o?.label ?? (typeof name === 'string' ? name : r),
})
export const button = (name: string | RegExp, o?: Opts) => role('button', name, o)
export const link = (name: string | RegExp, o?: Opts) => role('link', name, o)
export const tab = (name: string | RegExp, o?: Opts) => role('tab', name, o)

/** A part by a mark the page already has: `marked('n', 12)` is `[data-n="12"]`; `marked('swipe')` any `[data-swipe]`. */
export const marked = (attr: string, value?: string | number, o?: Opts): Target => ({
  css: value == null ? `[data-${attr}]` : `[data-${attr}="${value}"]`,
  within: o?.within,
  nth: o?.nth,
  label: o?.label ?? (value == null ? attr : `${attr} ${value}`),
})
/** A row of a list, by its number (its `data-n`). */
export const row = (n: number) => marked('n', n, { label: `Row ${n}` })

export const shows = (t: Target): Until => ({ shows: t })
export const gone = (t: Target): Until => ({ gone: t })
export const hasText = (t: Target, words: string): Until => ({ hasText: t, words })

// ---------------------------------------------------------------- finding a target on the screen

const ROLE: Record<string, string> = {
  button: 'button, [role="button"]',
  link: 'a[href], [role="link"]',
  tab: '[role="tab"]',
  textbox: 'textarea, input, [role="textbox"]',
}
export const nameOf = (e: Element) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim()
/** shown: it has a size and is not hidden */
export const shown = (e: Element) => {
  const r = e.getBoundingClientRect()
  // its own window's style: a Demo's part is in a frame of its own
  return r.width > 0 && r.height > 0 && (e.ownerDocument.defaultView ?? window).getComputedStyle(e).visibility !== 'hidden'
}

function findAll(root: Element, t: Target): Element[] {
  const places = t.within ? findAll(root, t.within).slice(0, 1) : [root]
  const out: Element[] = []
  for (const p of places) {
    const all = [...p.querySelectorAll(t.css ?? (t.role ? (ROLE[t.role] ?? `[role="${t.role}"]`) : '*'))].filter(shown)
    const name = t.name
    if (name == null) out.push(...all)
    else if (name instanceof RegExp) out.push(...all.filter((e) => name.test(nameOf(e))))
    else {
      // the whole name first, then its start: "Send (Shift + Enter)" is button('Send'), and "See" is not "See more"
      const whole = all.filter((e) => nameOf(e) === name)
      out.push(...(whole.length ? whole : all.filter((e) => nameOf(e).startsWith(name))))
    }
  }
  return out
}

/** The part a target names, if it is on the screen and shown. */
export function find(root: Element, t: Target): Element | null {
  return findAll(root, t)[t.nth ?? 0] ?? null
}
