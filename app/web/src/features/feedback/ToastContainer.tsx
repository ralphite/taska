// The toast with the page's data: what the feedback store says now.

import { useApp, useLayout, useStoreValue } from '../../app/context'
import { Toast } from './Toast'

export function ToastContainer() {
  const app = useApp()
  const layout = useLayout()
  const t = useStoreValue(app.stores.feedback, (s) => s.toast)
  const place = layout === 'desk' ? 'bottom-5 left-1/2 -translate-x-1/2' : 'inset-x-0 bottom-28 mx-auto'
  return (
    <Toast
      toast={t ? { text: t.text, error: t.error, sticky: t.sticky, action: t.action ? { label: t.action.label } : null } : null}
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
