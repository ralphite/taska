// T457, R488: the steps every demo is made of, so each one keeps a person's time. A demo is the real page (Player,
// on the demo project's saved answers); these only say a line, wait, and tap or type there as a person would.
// - One line under the screen for each step: what the screen is, a dot, then what the next tap does ("Needs you,
//   tap I04 ..."), short enough for one line under the phone.
// - The first screen stays 2.5 s; a line is read for 1.3 s before the finger lands; after a tap the new screen
//   stays at least 2 s before the next line; the last screen stays, with Play again.
// - Nothing of an agent is real or called: what an agent wrote is in the saved answers (D68).
import type { Ctx } from '../lib/player'

/** What the page has to show before a step can tap it: a demo that cannot find it stops, and says so. */
async function must(c: Ctx, sel: string, text?: string) {
  const el = await c.find(sel, text)
  if (!el) {
    c.say(`Demo stopped: ${text || sel} is not on the page`)
    throw new Error(`demo: nothing at ${sel}${text ? ` saying ${text}` : ''}`)
  }
  return el
}
/** The first screen, and what is next on it: 2.5 s to take it in. */
export async function first(c: Ctx, line: string) {
  c.say(line)
  await c.wait(2500)
}
/** Something to look at on this screen, with no tap: `ms` to read it. */
export async function look(c: Ctx, line: string, ms = 2800) {
  c.say(line)
  await c.wait(ms)
}
/** A row of chips that scrolls sideways (the views): the one to tap slides to its middle first, as a finger would
 * swipe it there, so the mark never lands on a chip half under the strip's arrows. */
async function inSight(c: Ctx, el: HTMLElement) {
  const view = c.doc.defaultView
  for (let s = el.parentElement; s && view; s = s.parentElement) {
    const o = view.getComputedStyle(s).overflowX
    if ((o !== 'auto' && o !== 'scroll') || s.scrollWidth <= s.clientWidth) continue
    const r = el.getBoundingClientRect(),
      b = s.getBoundingClientRect(),
      left = s.scrollLeft + r.left + r.width / 2 - (b.left + b.width / 2)
    if (Math.abs(left - s.scrollLeft) < 8) return
    s.scrollTo({ left, behavior: 'smooth' })
    return c.wait(700)
  }
}
/** One tap: its line, a moment to read it, the finger on `sel` (the one saying `text`), then time to see the change. */
export async function tap(c: Ctx, line: string, sel: string, text?: string) {
  if (line) c.say(line)
  await c.wait(1300)
  const el = await must(c, sel, text)
  await inSight(c, el)
  await c.tap(el)
  await c.wait(800)
}
/** Words typed into a field as a person types them: a Chinese character takes longer than a letter. */
export async function type(c: Ctx, line: string, sel: string, words: string) {
  c.say(line)
  await c.wait(1000)
  // the field is the page's (another window): its own kinds of element and event, not this window's
  const t = (await must(c, sel)) as HTMLInputElement,
    view = c.doc.defaultView
  if (!view || !('value' in t)) return
  t.focus()
  for (const ch of words) {
    t.value += ch
    t.dispatchEvent(new view.Event('input', { bubbles: true }))
    await c.wait(/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 450 : 110)
  }
  await c.wait(1500)
}
/** The last screen: it stays, with its line, and Play again under it. */
export const end = (c: Ctx, line: string) => look(c, line, 2000)
