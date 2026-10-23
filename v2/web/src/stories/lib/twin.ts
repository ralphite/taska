// B555 (r781, r785, r786): a component story is the real page in one of its states, showing only the part the story
// is about. It names an address the page reads (an item, a document, a view, a filter, a search: lib/url.ts) and what
// Yadong does there (a click, words typed, a key), on the demo's data; the page itself, the same code as on his
// screen, gets there (OnPage, ./onpage.tsx). A story never draws a component on its own nor sets the page's state, so
// it cannot show a state the page is never in (.storybook/check.mjs fails the build on a story that tries).
import type { Item } from '../../lib/types'
import type { Answers } from '../pages/screens'

/** One thing done on the page: Yadong's click (or tap; with Cmd or Shift held on the desktop) on what the selector
 * finds, a right-click on it, words he picks with the pointer, words he types into a field, a key; a press he holds
 * down (and moves, still held), a row he drags and holds over another (before it, into it, after it); an agent
 * writing to Taska in its own commands (the /agent language; on the real Taska server in the page), the organizer
 * filing the newest input (its model's answer: the commands it gives), an agent reading a page of Taska (/B06), Taska
 * going away or coming back; the pointer brought over something (what shows only under it: a row's buttons); a
 * picture pasted into the box (one of Storybook's saved files); a moment's wait (a voice note playing). A selector
 * "A >>> B" finds B inside the frame A finds (a web page document's own page). `on`: only on the desktop (d) or the
 * phone (p), where the page has it only there. */
export type Do = (
  | { click: string; hold?: 'Meta' | 'Shift' }
  | { menu: string }
  | { type: string; into: string }
  | { select: string; in: string }
  | { key: string }
  | { press: string; to?: string }
  | { drag: string; onto: string; drop: 'before' | 'into' | 'after' }
  | { agent: string }
  | { organize: string }
  | { read: string }
  | { online: boolean }
  | { point: string }
  | { paste: string }
  | { wait: number }
) & { on?: 'd' | 'p' }

/** Where on the page a story stands, and the part of it the story shows. */
export interface Twin {
  /** the page's address: /p/shop/T3, /p/shop/?status=wait, /p/shop/D1, /p/shop/agents ... */
  at: string
  /** what is done there, in order, once the page has drawn */
  steps?: Do[]
  /** the part the story shows: what these find, together (one that a screen does not draw is left out there); or one
   * for the desktop (d) and one for the phone (p) */
  part: Part | { d: Part; p: Part }
  /** the pointer on this, the keyboard's focus on this (what only a pointer or Tab shows) */
  hover?: string
  focus?: string
  /** the demo's items with other words (a very long title): only words, never a state of an item, which comes from
   * the demo's data, made by the real Taska from what its agents did (v2/tools/story_fixtures.py) */
  words?: Words
  /** how Taska answers (it never does, refuses, fails): what the page does then is its own */
  net?: Answers['net']
  /** the page's frame this tall (the screen's own when left out): a story may give it a larger view, and the page
   * lays out in it as it would on a screen that size (a whole long talk) */
  height?: number
  /** the real Taska server runs in the page (as for the Demos), so what the steps change (a reply, an approval) is
   * kept and the page shows what Taska answered: so when there are steps and no `net`, unless this says otherwise */
  live?: boolean
  /** a picture of the moment the steps leave: the page's clock stops a moment after, so what goes by itself after a
   * few seconds (a toast) stays as it was */
  still?: boolean
  /** what the speech model hears in a voice note recorded in the story (a device Storybook stands in for, on the real
   * server in the page): its words (`tr`, the microphone's sentence when left out), what may be misheard (`doubts`),
   * fuller words still to come (`more`); `working`: it has not answered yet; `fails`: it fails, saying this */
  heard?:
    | { tr?: string; doubts?: { was: string; alt: string; why: string; unsure?: boolean }[]; more?: boolean }
    | { working: true }
    | { fails: string }
}
type Part = string | string[]
export type Words = Record<number, Partial<Pick<Item, 'title' | 'body'>>>
/** The part's selectors on this screen. */
export const partOn = (part: Twin['part'], desk: boolean): string[] =>
  typeof part === 'object' && !Array.isArray(part) ? [part[desk ? 'd' : 'p']].flat() : [part].flat()

/** What only a pointer or a key shows (:hover, :focus-visible), on the page's own rules: each rule that has one gets
 * a copy that an attribute turns on (one the page's own code never sets, so drawing again keeps it), given to the part
 * and the parts around it, as the pointer is over all of them. */
export function pointed(page: Document, sel: string, how: 'hover' | 'focus-visible') {
  // what it is (one a pointer has not shown yet, too: a row's buttons), in the page or in a frame of it
  const el = find(page, sel) || (sel.includes(' >>> ') ? undefined : page.querySelector<HTMLElement>(sel) || undefined)
  if (!el) throw new Error(`nothing to point at: ${sel}`)
  const doc = el.ownerDocument,
    win = doc.defaultView as Window & typeof globalThis,
    mark = 'data-sb-' + how,
    pseudo = new RegExp('(?<!\\\\):' + how + '\\b', 'g') // the pseudo-class, not those words in a class's name
  const copy = (list: CSSRuleList, into: CSSStyleSheet | CSSGroupingRule | CSSStyleRule) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i]
      // the page's own kind of rule: its frame's, not this one's
      if (r instanceof win.CSSStyleRule && pseudo.test(r.selectorText)) {
        pseudo.lastIndex = 0
        try {
          into.insertRule(r.cssText.replace(r.selectorText, r.selectorText.replace(pseudo, `[${mark}]`)), i + 1)
        } catch {
          /* a rule this browser does not take */
        }
      }
      if ('cssRules' in r && (r as CSSGroupingRule).cssRules?.length)
        copy((r as CSSGroupingRule).cssRules, r as CSSGroupingRule)
    }
  }
  if (!doc.documentElement.hasAttribute(mark + '-rules')) {
    doc.documentElement.setAttribute(mark + '-rules', '') // the copies are made once per page
    for (const s of doc.styleSheets) {
      try {
        copy(s.cssRules, s)
      } catch {
        /* another origin's sheet */
      }
    }
  }
  for (let e: HTMLElement | null = el; e; e = e.parentElement) e.setAttribute(mark, '')
  if (how === 'hover') {
    const r = el.getBoundingClientRect(),
      at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove'])
      el.dispatchEvent(new win.PointerEvent(t, { ...at, bubbles: !t.endsWith('enter'), pointerType: 'mouse' }))
  } else el.focus({ preventScroll: true })
}
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
const onThis = (s: Do, win: Window) => !s.on || s.on === (win.innerWidth >= 1024 ? 'd' : 'p')

/** What the selector finds and the page shows. "A >>> B": B inside the frame A finds (a web page document's own
 * page). */
export function find(doc: Document, sel: string): HTMLElement | undefined {
  const [outer, inner] = sel.split(' >>> ')
  if (inner === undefined) return [...doc.querySelectorAll<HTMLElement>(sel)].find((e) => e.getClientRects().length)
  const f = [...doc.querySelectorAll<HTMLIFrameElement>(outer)].find((e) => e.getClientRects().length)
  return f?.contentDocument ? find(f.contentDocument, inner) : undefined
}
/** What the selector finds and the page shows, once it does (the page may still be loading or opening it). */
async function shown(doc: Document, sel: string, what: string) {
  for (let i = 0; i < 300; i++) {
    const el = find(doc, sel)
    if (el) return el
    await wait(50)
  }
  throw new Error(`${what}: ${sel}`)
}
const pointer = (win: Window) => (win.innerWidth >= 1024 ? 'mouse' : 'touch') // the desktop's mouse, the phone's finger
const middle = (el: HTMLElement, y = 0.5) => {
  const r = el.getBoundingClientRect()
  return { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * y }
}
/** A tap or a click where the selector finds something, as the page takes one (its pointer events, then the click). */
async function click(doc: Document, sel: string, hold?: 'Meta' | 'Shift') {
  const win = doc.defaultView as Window & typeof globalThis,
    el = await shown(doc, sel, 'nothing to click')
  el.scrollIntoView({ block: 'nearest' })
  const at = { ...middle(el), pointerType: pointer(win), metaKey: hold === 'Meta', shiftKey: hold === 'Shift' }
  el.dispatchEvent(new win.PointerEvent('pointerdown', at))
  el.dispatchEvent(new win.PointerEvent('pointerup', at))
  if (hold) el.dispatchEvent(new win.MouseEvent('click', at))
  else el.click()
  if (el.matches('input, textarea, select')) el.focus()
}
/** A right-click on it (a long press on the phone, as the browser tells the page of one): what the page opens at
 * the pointer. */
async function menu(doc: Document, sel: string) {
  const win = doc.defaultView as Window & typeof globalThis,
    el = await shown(doc, sel, 'nothing to right-click')
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const r = el.getBoundingClientRect()
  el.dispatchEvent(
    new win.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: r.left + Math.min(r.width * 0.6, 220),
      clientY: r.top + r.height / 2,
    }),
  )
}
/** A finger or the mouse down on it, and held; with `to`, moved, still held, over the middle of what that finds (a
 * project dragged to another's place, a line dragged). The pointer is one Storybook stands in for, which the browser
 * has no record of: the page's capture of it is let be. */
async function press(doc: Document, sel: string, to?: string) {
  const win = doc.defaultView as Window & typeof globalThis,
    el = await shown(doc, sel, 'nothing to press'),
    proto = win.Element.prototype as Element & { sbCapture?: boolean }
  if (!proto.sbCapture) {
    const capture = proto.setPointerCapture
    proto.setPointerCapture = function (id: number) {
      try {
        capture.call(this, id)
      } catch {
        /* a pointer the browser does not know */
      }
    }
    proto.sbCapture = true
  }
  const at = { ...middle(el), pointerType: pointer(win), pointerId: 1, button: 0, buttons: 1, isPrimary: true }
  el.dispatchEvent(new win.PointerEvent('pointerdown', at))
  if (!to) return
  const end = middle(await shown(doc, to, 'nowhere to move to'))
  for (let i = 1; i <= 6; i++) {
    await wait(30)
    const x = at.clientX + ((end.clientX - at.clientX) * i) / 6,
      y = at.clientY + ((end.clientY - at.clientY) * i) / 6
    ;(doc.elementFromPoint(x, y) || el).dispatchEvent(
      new win.PointerEvent('pointermove', { ...at, clientX: x, clientY: y }),
    )
  }
}
/** The mouse down on a row, dragged (the browser's own drag and drop, as the page takes it) and held over another:
 * before it (its top), into it (its middle), after it (its foot). */
async function drag(doc: Document, sel: string, onto: string, drop: 'before' | 'into' | 'after') {
  const win = doc.defaultView as Window & typeof globalThis,
    el = await shown(doc, sel, 'nothing to drag'),
    to = await shown(doc, onto, 'nowhere to drag to')
  const from = middle(el),
    end = middle(to, { before: 0.15, into: 0.5, after: 0.85 }[drop]),
    dataTransfer = new win.DataTransfer()
  el.dispatchEvent(new win.PointerEvent('pointerdown', { ...from, pointerType: 'mouse', button: 0, buttons: 1 }))
  el.dispatchEvent(new win.DragEvent('dragstart', { ...from, cancelable: true, dataTransfer }))
  await wait(50)
  ;(doc.elementFromPoint(end.clientX, end.clientY) || to).dispatchEvent(
    new win.DragEvent('dragover', { ...end, cancelable: true, dataTransfer }),
  )
}
type Server = {
  agent: (p: string, t: string) => string
  organize: (p: string, plan: string) => void
  read: (p: string, path: string) => void
  online: (on: boolean) => void
}
/** The real Taska server in the page (a live story's). */
async function server(doc: Document) {
  const win = doc.defaultView as Window & { __storyServer?: Promise<Server> }
  if (!win.__storyServer) throw new Error('only the real Taska server in the page (live) has agents and goes away')
  return await win.__storyServer
}
/** An agent writes to Taska, or reads one of its pages; Taska goes away or comes back. The page, looked at, asks for
 * the news at once (as the browser tells it it is looked at), or hears that the connection went or came. */
async function onServer(
  doc: Document,
  project: string,
  s: { agent: string } | { organize: string } | { read: string } | { online: boolean },
) {
  const win = doc.defaultView as Window,
    t = await server(doc)
  if ('agent' in s) t.agent(project, s.agent)
  else if ('organize' in s) t.organize(project, s.organize)
  else if ('read' in s) t.read(project, s.read)
  else {
    t.online(s.online)
    win.dispatchEvent(new Event(s.online ? 'online' : 'offline'))
    return
  }
  win.dispatchEvent(new Event('focus'))
}
/** Words typed into a field: the field's own setter and its input event, as the browser does for a key. */
async function type(doc: Document, into: string, words: string) {
  const win = doc.defaultView as Window & typeof globalThis,
    f = await shown(doc, into, 'no field')
  if (!(f instanceof win.HTMLInputElement || f instanceof win.HTMLTextAreaElement)) throw new Error(`no field: ${into}`)
  f.focus()
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(f), 'value')?.set?.call(f, words)
  f.dispatchEvent(new win.Event('input', { bubbles: true }))
}
/** Words picked with the pointer (dragged over) in what the selector finds: the browser's own selection of them. */
async function select(doc: Document, words: string, sel: string) {
  const win = doc.defaultView as Window & typeof globalThis,
    el = await shown(doc, sel, 'nothing to select in'),
    walk = doc.createTreeWalker(el, win.NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const at = (n.textContent || '').indexOf(words)
    if (at < 0) continue
    const r = doc.createRange()
    r.setStart(n, at)
    r.setEnd(n, at + words.length)
    win.getSelection()?.removeAllRanges()
    win.getSelection()?.addRange(r)
    const box = r.getBoundingClientRect()
    el.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true, clientX: box.right, clientY: box.bottom }))
    return
  }
  throw new Error(`no such words to select: ${words}`)
}
/** A key or a chord ("o", "Meta+k", "Shift+?") where the page has its focus. */
function key(doc: Document, chord: string) {
  const win = doc.defaultView as Window & typeof globalThis,
    parts = chord.split('+'),
    k = parts.pop() || '+',
    o = { key: k, bubbles: true, cancelable: true, metaKey: parts.includes('Meta'), shiftKey: parts.includes('Shift') },
    to = (doc.activeElement as HTMLElement | null) || doc.body
  to.dispatchEvent(new win.KeyboardEvent('keydown', o))
  to.dispatchEvent(new win.KeyboardEvent('keyup', o))
}
/** A picture pasted into the box, as from the clipboard. */
async function paste(doc: Document, url: string) {
  const win = doc.defaultView as Window & typeof globalThis,
    t = await shown(doc, '#text', 'no box'),
    blob = await (await win.fetch(url)).blob(),
    dt = new win.DataTransfer()
  dt.items.add(new win.File([blob], url.split('__').pop() || 'image.png', { type: blob.type }))
  t.focus()
  t.dispatchEvent(new win.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
}

/** The steps, done on the page in its frame (of this project), as a person does them. */
export async function doSteps(doc: Document, steps: Do[], project: string) {
  const win = doc.defaultView as Window
  for (const s of steps) {
    if (!onThis(s, win)) continue
    if ('click' in s) await click(doc, s.click, s.hold)
    else if ('menu' in s) await menu(doc, s.menu)
    else if ('type' in s) await type(doc, s.into, s.type)
    else if ('select' in s) await select(doc, s.select, s.in)
    else if ('key' in s) key(doc, s.key)
    else if ('press' in s) await press(doc, s.press, s.to)
    else if ('drag' in s) await drag(doc, s.drag, s.onto, s.drop)
    else if ('point' in s) pointed(doc, s.point, 'hover')
    else if ('paste' in s) await paste(doc, s.paste)
    else if ('wait' in s) await wait(s.wait)
    else await onServer(doc, project, s)
    await wait('agent' in s || 'organize' in s || 'read' in s ? 1500 : 350)
  }
}
