// The part that scrolls something: the thing itself when it scrolls (the desktop's talk, beside the item), else the
// nearest part round it that does (the phone's page, the item and its talk on it). So the talk opens at its latest
// message and goes to its end after you send in one way on both (T589 #10486: the phone's stayed at its top).

/** `el` itself when it scrolls, else the nearest part round it that does. */
export function scrollerOf(el: HTMLElement): HTMLElement | null {
  const view = el.ownerDocument.defaultView
  for (let p: HTMLElement | null = el; p; p = p.parentElement) if (view && /auto|scroll/.test(view.getComputedStyle(p).overflowY)) return p
  return null
}

/** Whether the part that scrolls `sc` shows its end. */
export const atEnd = (sc: HTMLElement) => sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4

/** Whether the talk keeps to its end after `sc` scrolled from `was`: it shows its end, or it kept to it and nothing
 * scrolled it up (the page's own scroll to the end can come after the talk grew again). */
export const keepsEnd = (sc: HTMLElement, was: number, end: boolean) => atEnd(sc) || (end && sc.scrollTop >= was)

/** What scrolls `el` scrolled to its end (the talk: to what was said last). */
export function toEnd(el: HTMLElement): void {
  const sc = scrollerOf(el)
  if (sc) sc.scrollTop = sc.scrollHeight
}
