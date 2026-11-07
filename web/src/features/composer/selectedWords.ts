// The words selected on the page that a comment can be about, and where the bar over them goes: the page's
// SelectionBarContainer and a document's stories follow the browser's selection through the same code (B708 r1149).

import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Box } from './SelectionBar'

export interface Selected {
  d: number | null
  key: string | null
  text: string
  range: Range
}

/** The words selected now that a voice comment can be about: a document's passage (`doc`, its number) or words where
 * voice comments go; none while an area is circled. */
export function selected(doc: number | null, circle: boolean): Selected | null {
  const sel = typeof getSelection === 'undefined' ? null : getSelection()
  if (circle || !sel?.rangeCount || sel.isCollapsed) return null
  const text = sel.toString().trim()
  const an = sel.anchorNode
  const node = an?.nodeType === 1 ? (an as Element) : an?.parentElement
  if (text.length < 2 || !node) return null
  if (doc != null) {
    // a document: the comment goes on that passage (not on the words of a comment)
    const sec = !node.closest('[data-thread]') && node.closest<HTMLElement>(`[data-doc-blocks="${doc}"] section[data-key]`)
    return sec ? { d: doc, key: sec.dataset.key || null, text: text.slice(0, 500), range: sel.getRangeAt(0) } : null
  }
  if (node.closest('#composer, input, textarea, [contenteditable], button, [data-selection-bar], [role=status]')) return null
  return node.closest('[data-vc-area]') ? { d: null, key: null, text: text.slice(0, 500), range: sel.getRangeAt(0) } : null
}

/** The words selected and where the bar goes, drawn again as the selection, the scrolling and the window change.
 * `rec`: something records (no words are offered); `onBar`: what records was started from the bar, which stays where
 * the words were when it started (`start`; `forget` when it did not start after all). */
export function useSelectedWords(doc: number | null, circle: boolean, rec: boolean, onBar: boolean) {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  // where the words were when it started recording, and how far the page had scrolled
  const started = useRef<{ range: Range; rect: Box; top: number; scroller: Element | null } | null>(null)
  useEffect(() => {
    document.addEventListener('selectionchange', redraw)
    addEventListener('scroll', redraw, true)
    addEventListener('resize', redraw)
    return () => {
      document.removeEventListener('selectionchange', redraw)
      removeEventListener('scroll', redraw, true)
      removeEventListener('resize', redraw)
    }
  }, [])
  /** the bar's mic starts recording about `pick`: the bar stays where those words are */
  const start = useCallback((pick: Selected) => {
    const r = pick.range.getBoundingClientRect()
    const scroller = pick.range.startContainer.parentElement?.closest('[data-vc-area]') ?? null
    started.current = { range: pick.range.cloneRange(), rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height }, top: scroller?.scrollTop || 0, scroller }
  }, [])
  const forget = useCallback(() => {
    started.current = null
  }, [])
  const s = rec ? null : selected(doc, circle)
  let at: Box | null = null
  let from: Range | null = null
  // eslint-disable-next-line react-hooks/refs -- where the words are now is read as the page is drawn
  const st = onBar ? started.current : null
  if (st) {
    from = st.range
    const r = st.range.getBoundingClientRect()
    if (r.width || r.height) at = r
    else {
      // the page was drawn again meanwhile: where the words were, as the page scrolled since
      const dy = (st.scroller?.scrollTop || 0) - st.top
      at = { top: st.rect.top - dy, bottom: st.rect.bottom - dy, left: st.rect.left, width: st.rect.width, height: st.rect.height }
    }
  } else if (!onBar && s) {
    from = s.range
    const r = s.range.getBoundingClientRect()
    if (r.width || r.height) at = r
  }
  // `from`: the words `at` is where of
  // eslint-disable-next-line react-hooks/refs -- where the words started is read as the page is drawn (above)
  return { s, at, from, start, forget }
}
