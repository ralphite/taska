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
export const failedRetry: (() => unknown)[] = []

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
  if (TOAST.sticky) failedRetry.length = 0 // closed: those changes are given up
  TOAST.sticky = false
  kept = null
  bump('toast')
}
export const hint = (t: string) => toast(t) // a key that can't act here says why, in a few words (T113 B26)
