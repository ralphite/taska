// Errors the page did not catch go to Taska's log (T582 #4), so what breaks on the phone can be read there: each
// message once per page load, at most 20. It also asks the browser to keep this site's stored data (drafts, voice
// notes not sent yet) when space runs short.

import type { TaskaApi } from '../../api/taska'

const MAX = 20

export class PageErrors {
  private readonly told = new Set<string>()
  readonly stop: () => void

  constructor(d: { api: Pick<TaskaApi, 'pageLog'>; slug(): string }) {
    const tell = (msg: string, stack: string) => {
      const slug = d.slug()
      if (!slug || !msg || this.told.has(msg) || this.told.size >= MAX) return
      this.told.add(msg)
      void d.api.pageLog(slug, [{ kind: 'error', level: 'error', msg: msg.slice(0, 300), where: location.pathname, stack: stack.split('\n').slice(0, 6).join('\n'), ua: navigator.userAgent }]).catch(() => {})
    }
    const onError = (e: ErrorEvent) => tell(e.message || String(e.error || ''), String((e.error as Error | undefined)?.stack || `${e.filename}:${e.lineno}`))
    const onReject = (e: PromiseRejectionEvent) => {
      const r = e.reason as Error | undefined
      tell(String(r?.message || r || ''), String(r?.stack || ''))
    }
    if (typeof window === 'undefined') {
      this.stop = () => {}
      return
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onReject)
    void navigator.storage?.persist?.().catch(() => {})
    this.stop = () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onReject)
    }
  }
}
