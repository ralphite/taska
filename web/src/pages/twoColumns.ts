// The desktop's item pane in two columns (the item, or its open document, on the left; its talk on the right) while
// the pane is 1100px wide or more and the item does not fit the part above the line (where you put it, 40% by
// default) or its talk the part below; a document shows beside its item's talk whenever the pane is that wide. Once
// in two columns, an item stays so while it is open: a fold, a reply or another item that would fit in one never
// takes it back to one column; a pane too narrow shows one, and the same width again shows two again.

import { useLayoutEffect, useRef } from 'react'

const MIN = 1100

export function useTwoColumns(body: HTMLElement | null, shows: boolean, doc: boolean, set: (on: boolean) => void): void {
  const stuck = useRef(false)
  useLayoutEffect(() => {
    if (!shows) stuck.current = false
    if (!body || typeof ResizeObserver === 'undefined') return set(false)
    const check = () => {
      const top = body.querySelector<HTMLElement>('[data-item-clip]') || body.querySelector<HTMLElement>('[data-item-top]')
      const talk = body.querySelector<HTMLElement>('[data-item-talk]')
      const h = body.clientHeight
      const want = parseFloat(getComputedStyle(body).getPropertyValue('--top-h'))
      const upper = want > 0 ? Math.min(want, h) : h * 0.4
      const high = ((top?.firstElementChild as HTMLElement | null)?.offsetHeight || 0) > upper || ((talk?.firstElementChild as HTMLElement | null)?.offsetHeight || 0) > h - upper
      const on = shows && body.clientWidth >= MIN && (doc || high || stuck.current)
      if (on && !doc) stuck.current = true
      set(on)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(body)
    // what is in either part grows or shrinks too (a message comes, a picture loads)
    for (const sel of ['[data-item-clip]', '[data-item-top]', '[data-item-talk]']) {
      const c = body.querySelector(sel)?.firstElementChild
      if (c) ro.observe(c)
    }
    return () => ro.disconnect()
  })
}
