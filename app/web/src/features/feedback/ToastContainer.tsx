// The toast with the page's data: what the feedback store says now, placed over the pane you acted in (on the
// desktop above the box when the box is in that pane), or above the box on the phone; on a page of Settings near its
// top.

import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { usePanes } from '../../app/panes'
import { Toast } from './Toast'

export function ToastContainer() {
  const app = useServices('toasts')
  const stores = useStores('feedback', 'route', 'sheet')
  const layout = useLayout()
  const panes = usePanes()
  const t = useStoreValue(stores.feedback, (s) => s.toast)
  const onPage = useStoreValue(stores.route, (s) => s.route.page === 'project' && s.route.place.kind === 'settings')
  // the phone: what is open over the page (the drawer, a sheet, a card) the toast keeps clear of
  const drawer = useStoreValue(stores.route, (s) => s.layers.includes('drawer'))
  const docOver = useStoreValue(stores.route, (s) => s.route.page === 'project' && s.route.place.kind === 'doc') && layout === 'phone'
  const sheet = useStoreValue(stores.sheet, (s) => (s.spec ? (s.spec.card ? 'card' : 'sheet') : null))
  const over = sheet ?? (docOver ? 'sheet' : null)
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined)
  const [centered, setCentered] = useState(false)
  // you act in another pane: the toast shown goes over it
  const [moved, setMoved] = useState(0)
  useEffect(() => panes?.onLast(() => setMoved((x) => x + 1)), [panes])
  useLayoutEffect(() => {
    if (!t || !panes) return
    const foot = panes.get('foot')
    if (onPage) {
      const r = layout === 'desk' ? panes.get('settings')?.getBoundingClientRect() : undefined
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCentered(!!r)
      setStyle(r ? { left: `${r.left + r.width / 2}px`, top: '8rem', bottom: 'auto' } : { top: layout === 'desk' ? '8rem' : 'calc(env(safe-area-inset-top) + 0.75rem)', bottom: 'auto' })
    } else if (layout === 'desk') {
      const last = panes.last === 'drawer' ? null : panes.last ? panes.get(panes.last) : null
      const pane = last || panes.get('detail') || panes.get('inputs') || panes.get('settings')
      const r = pane?.getBoundingClientRect()
      const f = foot?.getBoundingClientRect()
      const above = r && f && f.height < 300 && f.left < r.right && f.right > r.left
      // placed by measuring the panes before the browser paints (React's useLayoutEffect measuring pattern)
      setCentered(!!r)
      setStyle(r ? { left: `${r.left + r.width / 2}px`, bottom: `${above && f ? innerHeight - f.top + 12 : 20}px` } : undefined)
    } else {
      // just above what you act on (the box, the drawer's foot, a sheet's foot), never on it; else near the top
      setCentered(false)
      const bar = drawer ? panes.get('drawerFoot') : !over ? (foot && !foot.hidden ? foot : null) : over === 'card' ? null : panes.get('sheetFoot')
      setStyle(bar && bar.offsetHeight ? { bottom: `${Math.round(innerHeight - bar.getBoundingClientRect().top + 8)}px` } : over ? { top: 'calc(env(safe-area-inset-top) + 0.75rem)', bottom: 'auto' } : undefined)
    }
  }, [t, layout, panes, onPage, moved, drawer, over])
  const place =
    layout === 'desk'
      ? `${style ? '' : 'bottom-5 left-5'} ${centered ? '-translate-x-1/2' : ''}`
      : `inset-x-0 mx-auto ${style ? '' : 'bottom-28'}`
  return (
    <Toast
      toast={t ? { text: t.text, error: t.error, sticky: t.sticky, action: t.action ? { label: t.action.label } : null } : null}
      style={style}
      place={place}
      onAction={() => {
        const run = t?.action?.run
        app.toasts.hide()
        void run?.()
      }}
      onClose={() => app.toasts.hide()}
    />
  )
}
