// The part that scrolls something: the thing itself when it scrolls (the desktop's talk, beside the item), else the
// nearest part round it that does (the phone's page, the item and its talk on it). So the talk opens at its latest
// message and goes to its end after you send in one way on both (T589 #10486: the phone's stayed at its top).

/** `el` itself when it scrolls, else the nearest part round it that does. */
export function scrollerOf(el: HTMLElement): HTMLElement | null {
  const view = el.ownerDocument.defaultView
  for (let p: HTMLElement | null = el; p; p = p.parentElement) if (view && /auto|scroll/.test(view.getComputedStyle(p).overflowY)) return p
  return null
}

/** Whether more of what `el` scrolls is below what it shows. */
export const overflows = (el: HTMLElement) => el.scrollTop + el.clientHeight < el.scrollHeight - 2

/** Whether the part that scrolls `sc` shows its end. */
export const atEnd = (sc: HTMLElement) => sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4

/** What the button to the end is: down to the end while what scrolls `sc` does not show its end (F716 r1171); at the
 * end, up, back to the top (F752 r1250); none when there is nothing to scroll. */
export const toEndWay = (sc: HTMLElement): 'down' | 'up' | 'none' => (sc.scrollHeight <= sc.clientHeight + 4 ? 'none' : atEnd(sc) ? 'up' : 'down')

/** Whether the talk keeps to its end after `sc` scrolled from `was`: it shows its end, or it kept to it and nothing
 * scrolled it up (the page's own scroll to the end can come after the talk grew again). */
export const keepsEnd = (sc: HTMLElement, was: number, end: boolean) => atEnd(sc) || (end && sc.scrollTop >= was)

/** At its end the talk never gets shorter under you (B770 r1292): what it shows last getting shorter (a voice note's
 * "confirming" line going as its final words come) would take what scrolls it up with it. While `end`, `body` keeps
 * the height it had (`tall`); once it is taller again, or the talk left its end, nothing is held. -> its height now. */
export function holdHeight(body: HTMLElement, tall: number, end: boolean): number {
  if (!end) body.style.minHeight = ''
  const h = body.offsetHeight
  if (body.style.minHeight && h > tall) body.style.minHeight = ''
  if (!end || h >= tall) return h
  body.style.minHeight = `${tall}px`
  return tall
}

/** What scrolls `el` scrolled to its end (the talk: to what was said last). */
export function toEnd(el: HTMLElement): void {
  const sc = scrollerOf(el)
  if (sc) sc.scrollTop = sc.scrollHeight
}
