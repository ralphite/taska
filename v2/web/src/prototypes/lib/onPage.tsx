// What a prototype puts on the real page (the page itself runs unchanged in the story's frame): its own new parts,
// drawn with React and the page's own styles in a layer of the page's document, and changes to the look of the
// page's parts, each kept so it can be taken back.
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class OnPage {
  private root: Root
  private was = new Map<HTMLElement, string>()
  readonly win: Window
  constructor(readonly doc: Document) {
    const layer = doc.createElement('div')
    layer.id = 'protoLayer'
    doc.body.append(layer)
    this.root = createRoot(layer)
    this.win = doc.defaultView as Window
  }
  /** the prototype's parts, drawn now (not on the next frame), so what comes after sees them */
  draw(node: ReactNode) {
    flushSync(() => this.root.render(node))
  }
  /** a place for a new part in the page's own flow, just before one of its parts: what is drawn there moves and
   * scrolls with the page */
  slot(before: HTMLElement | null) {
    if (!before?.parentElement) return () => {}
    const box = this.doc.createElement('div')
    box.className = 'contents'
    box.dataset.protoSlot = ''
    before.parentElement.insertBefore(box, before)
    const root = createRoot(box)
    return (node: ReactNode) => flushSync(() => root.render(node))
  }
  $(sel: string) {
    return this.doc.querySelector<HTMLElement>(sel)
  }
  /** a part of the page looks different while the prototype shows it */
  set(el: HTMLElement | null, css: Partial<CSSStyleDeclaration>) {
    if (!el) return
    if (!this.was.has(el)) this.was.set(el, el.style.cssText)
    Object.assign(el.style, css)
  }
  /** every part of the page as the page drew it */
  undo() {
    for (const [el, css] of this.was) el.style.cssText = css
    this.was.clear()
  }
  /** the page's address now */
  path() {
    return this.win.location.pathname
  }
  /** the page goes to an address, as its own Back and links take it there */
  async go(path: string) {
    if (this.path() === path) return
    this.win.history.pushState(null, '', path)
    this.win.dispatchEvent(new PopStateEvent('popstate'))
    for (let i = 0; i < 40 && this.path() !== path; i++) await wait(25)
    await wait(120)
  }
  /** waits until the page shows it */
  async find(sel: string, ms = 4000) {
    for (let t = 0; t < ms; t += 50) {
      const el = this.$(sel)
      if (el && el.getClientRects().length) return el
      await wait(50)
    }
    return null
  }
}
