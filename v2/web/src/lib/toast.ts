// What just happened, in one line (T160). With `act` it carries a button for a few seconds: Undo, or `label`. An
// error is red, is read out at once (role=alert) and stays longer.
import { bump } from './state'
import { errorLog, pushUndo } from './data'

export interface ToastState {
  text: string
  act: (() => unknown) | null
  label: string
  error: boolean
  shown: boolean
  n: number
  sticky: boolean
}
export const TOAST: ToastState = { text: '', act: null, label: 'Undo', error: false, shown: false, n: 0, sticky: false }
// B326: a sticky toast (a change that was not saved) stays until you act on it or close it; a toast shown over it
// gives it back when it goes
let kept: ToastState | null = null
let timer = 0
// T424 step 3: every change that did not go in stays in one place, the red "N not saved" at the top of the page,
// until you retry it or let it go: what it was, why, and when. A toast says so once as well.
export interface Failed {
  id: number
  what: string
  why: string
  at: number
  retry: (() => unknown) | null
}
export const FAILED: Failed[] = []
let fid = 0
export function addFailed(what: string, why: string, retry: (() => unknown) | null = null) {
  const f = { id: ++fid, what, why, at: Date.now(), retry }
  FAILED.unshift(f)
  toast(`Not saved: ${what}${retry ? '' : `: ${why}`}`, retry ? () => retryFailed(f.id) : null, {
    error: true,
    label: 'Retry',
  })
  bump('head', 'dialog')
  return f
}
/** Send it again (it leaves the list; if it fails again it comes back). Without an id: all of them, oldest first. */
export function retryFailed(id?: number) {
  const go = FAILED.filter((f) => f.retry && (id === undefined || f.id === id)).reverse()
  dropFailed(id)
  for (const f of go) void f.retry?.()
}
export function dropFailed(id?: number) {
  for (let i = FAILED.length - 1; i >= 0; i--) if (id === undefined || FAILED[i].id === id) FAILED.splice(i, 1)
  bump('head', 'dialog')
}
export const failedWaiting = () => FAILED.some((f) => f.retry)

type Run = (() => unknown) & { entry?: unknown }
export function toast(text: string, act?: Run | null, { error = false, label = 'Undo', ms = 0, sticky = false } = {}) {
  if (act && label === 'Undo' && !act.entry) act = pushUndo(text, act as () => Promise<unknown>) // every Undo is also Z's, and runs once (T113 A7)
  if (TOAST.shown && TOAST.sticky && !sticky) kept = { ...TOAST } // it comes back after this one
  if (sticky) kept = null
  if (error || sticky) errorLog(text, 'red message') // T335
  Object.assign(TOAST, { text, act: act || null, label, error, shown: true, n: TOAST.n + 1, sticky })
  clearTimeout(timer)
  if (!sticky)
    timer = window.setTimeout(
      () => {
        TOAST.shown = false
        if (kept) {
          Object.assign(TOAST, kept, { shown: true, n: TOAST.n + 1 })
          kept = null
        }
        bump('toast')
      },
      ms || (error ? 8000 : act ? 5000 : 2600),
    )
  bump('toast')
}
export function hideToast() {
  TOAST.shown = false
  TOAST.sticky = false
  kept = null
  bump('toast')
}
export const hint = (t: string) => toast(t) // a key that can't act here says why, in a few words (T113 B26)
