// The bar on selected words, with the page: what is selected (a document's passage, an item's words and its talk,
// what you said), where it is, and what the bar does with it. It follows the selection, the scrolling and the window;
// while it records it stays where the words were.

import { useEffect, useReducer, useRef } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { SelectionBar, type Box } from './SelectionBar'

interface Selected {
  d: number | null
  key: string | null
  text: string
  range: Range
}

/** The words selected now that a voice comment can be about. */
function selected(doc: number | null, circle: boolean): Selected | null {
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

/** Words of a voice note's input selected: they can be corrected. */
function fixable(byId: ReadonlyMap<string, { text: string; v?: number }> | undefined): { id: string; wrong: string; v: number } | null {
  const sel = typeof getSelection === 'undefined' ? null : getSelection()
  const text = sel?.toString().replace(/\s+/g, ' ').trim()
  if (!sel || !text || text.length > 60) return null
  const node = sel.anchorNode
  const el = (node?.nodeType === 1 ? (node as Element) : node?.parentElement)?.closest<HTMLElement>('[data-voice]')
  const r = el && el.contains(sel.focusNode) ? byId?.get(el.dataset.voice as string) : undefined
  return r && r.text.includes(text) ? { id: el?.dataset.voice as string, wrong: text, v: r.v || 0 } : null
}

export function SelectionBarContainer({ route }: { route: ProjectRoute }) {
  const app = useServices('box', 'docVoice', 'fields')
  const stores = useStores('box', 'docView', 'recording')
  const m = useProjectModel(route.slug)
  const rec = useStoreValue(stores.recording, (s) => s.rec)
  const circle = useStoreValue(stores.docView, (s) => s.circle)
  const mode = useStoreValue(stores.box, (s) => s.mode)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  // where the words were when it started recording, and how far the page had scrolled
  const started = useRef<{ range: Range; rect: Box; top: number; scroller: Element | null } | null>(null)
  useEffect(() => {
    const seen = () => {
      redraw()
      // the selection went before you wrote anything: no more correcting
      const b = stores.box.getState().mode
      const text = getSelection()?.toString().trim()
      const box = app.fields.get('box') as HTMLTextAreaElement | null
      if (b?.kind === 'correct' && b.bySel && !text && !box?.value.trim() && !box?.closest('#composer')?.contains(document.activeElement)) app.box.stop()
    }
    document.addEventListener('selectionchange', seen)
    addEventListener('scroll', redraw, true)
    addEventListener('resize', redraw)
    return () => {
      document.removeEventListener('selectionchange', seen)
      removeEventListener('scroll', redraw, true)
      removeEventListener('resize', redraw)
    }
  }, [app, stores])
  const doc = route.place.kind === 'doc' ? route.place.d : null
  const on = !!rec?.about?.bar
  const s = rec ? null : selected(doc, circle)
  const fix = !rec ? fixable(m?.byId) : null
  const fixNow = fix && !(mode?.kind === 'correct' && mode.id === fix.id && mode.wrong === fix.wrong) ? fix : null
  let at: Box | null = null
  // eslint-disable-next-line react-hooks/refs -- where the words are now is read as the page is drawn
  const st = on ? started.current : null
  if (st) {
    const r = st.range.getBoundingClientRect()
    if (r.width || r.height) at = r
    else {
      // the page was drawn again meanwhile: where the words were, as the page scrolled since
      const dy = (st.scroller?.scrollTop || 0) - st.top
      at = { top: st.rect.top - dy, bottom: st.rect.bottom - dy, left: st.rect.left, width: st.rect.width, height: st.rect.height }
    }
  } else if (!on && s) {
    const r = s.range.getBoundingClientRect()
    if (r.width || r.height) at = r
  }
  return (
    <SelectionBar
      at={at}
      recording={on}
      comment={!rec && !!s?.key && doc != null}
      fix={!!fixNow}
      on={{
        mic: () => {
          const pick = selected(doc, circle)
          if (!on && pick) {
            const r = pick.range.getBoundingClientRect()
            const scroller = pick.range.startContainer.parentElement?.closest('[data-vc-area]') ?? null
            started.current = { range: pick.range.cloneRange(), rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height }, top: scroller?.scrollTop || 0, scroller }
          }
          void app.docVoice.bar(route.slug, pick ? { d: pick.d, key: pick.key, quote: pick.text } : null).then((go) => {
            if (!go && !stores.recording.getState().rec) started.current = null
          })
        },
        // B584: selecting words changes nothing; Comment makes them what the box comments on
        comment: () => {
          const pick = selected(doc, circle)
          if (pick?.key) stores.docView.getState().pick({ quote: { key: pick.key, text: pick.text }, sel: new Set(), reply: null })
          app.fields.get('box')?.focus({ preventScroll: true })
        },
        fix: () => {
          if (!fixNow) return
          app.box.correctStart(fixNow.id, fixNow.wrong, fixNow.v)
          app.fields.focus('box')
        },
      }}
    />
  )
}
