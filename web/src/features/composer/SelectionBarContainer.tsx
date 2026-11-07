// The bar on selected words, with the page: what is selected (a document's passage, an item's words and its talk,
// what you said), where it is (selectedWords: it follows the selection, the scrolling and the window; while it records
// it is the recording strip, where the words were), and what the bar does with it.

import { useEffect } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { RecMeter } from '../../app/RecMeter'
import { PLACE_LEVELS } from '../../ui/PlaceVoice'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { SelectionBar } from './SelectionBar'
import { selected, useSelectedWords } from './selectedWords'

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
  const app = useServices('box', 'docVoice', 'fields', 'voice')
  const desk = useLayout() === 'desk'
  const stores = useStores('box', 'docView', 'recording')
  const m = useProjectModel(route.slug)
  const rec = useStoreValue(stores.recording, (s) => s.rec)
  const circle = useStoreValue(stores.docView, (s) => s.circle)
  const mode = useStoreValue(stores.box, (s) => s.mode)
  const doc = route.place.kind === 'doc' ? route.place.d : null
  const on = !!rec?.about?.bar
  const words = useSelectedWords(doc, circle, !!rec, on)
  useEffect(() => {
    // the selection went before you wrote anything: no more correcting
    const seen = () => {
      const b = stores.box.getState().mode
      const text = getSelection()?.toString().trim()
      const box = app.fields.get('box') as HTMLTextAreaElement | null
      if (b?.kind === 'correct' && b.bySel && !text && !box?.value.trim() && !box?.closest('#composer')?.contains(document.activeElement)) app.box.stop()
    }
    document.addEventListener('selectionchange', seen)
    return () => document.removeEventListener('selectionchange', seen)
  }, [app, stores])
  const { s, at } = words
  const fix = !rec ? fixable(m?.byId) : null
  const fixNow = fix && !(mode?.kind === 'correct' && mode.id === fix.id && mode.wrong === fix.wrong) ? fix : null
  return (
    <SelectionBar
      at={at}
      recording={on}
      desk={desk}
      meter={<RecMeter n={desk ? PLACE_LEVELS.desk : PLACE_LEVELS.phone} />}
      comment={!rec && !!s?.key && doc != null}
      fix={!!fixNow}
      on={{
        mic: () => {
          const pick = selected(doc, circle)
          if (!on && pick) words.start(pick)
          void app.docVoice.bar(route.slug, pick ? { d: pick.d, key: pick.key, quote: pick.text } : null).then((go) => {
            if (!go && !stores.recording.getState().rec) words.forget()
          })
        },
        // B584: selecting words changes nothing; Comment makes them what the box comments on
        comment: () => {
          const pick = selected(doc, circle)
          if (pick?.key) stores.docView.getState().pick({ quote: { key: pick.key, text: pick.text }, sel: new Set(), reply: null })
          app.fields.get('box')?.focus({ preventScroll: true })
        },
        // its recording strip: ✕, ✓ (the desktop's box, the phone sends) and ↑ (B498)
        cancel: () => void app.voice.cancel(),
        check: () => void app.docVoice.check(),
        send: () => void app.docVoice.sendNow(),
        fix: () => {
          if (!fixNow) return
          app.box.correctStart(fixNow.id, fixNow.wrong, fixNow.v)
          app.fields.focus('box')
        },
      }}
    />
  )
}
