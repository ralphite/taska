// What just happened, in one line (T160). With `act` it carries a button for a few seconds: Undo, or `label`. An
// error is red, is read out at once (role=alert) and stays longer.
import { bump } from './state'
import { pushUndo } from './data'

export interface ToastState {
  text: string
  act: (() => unknown) | null
  label: string
  error: boolean
  shown: boolean
  n: number
}
export const TOAST: ToastState = { text: '', act: null, label: 'Undo', error: false, shown: false, n: 0 }
let timer = 0
export const failedRetry: (() => unknown)[] = []

type Run = (() => unknown) & { entry?: unknown }
export function toast(text: string, act?: Run | null, { error = false, label = 'Undo', ms = 0 } = {}) {
  if (act && label === 'Undo' && !act.entry) act = pushUndo(text, act as () => Promise<unknown>) // every Undo is also Z's, and runs once (T113 A7)
  if (!error) failedRetry.length = 0 // the red toast this one replaces takes its Retry along
  Object.assign(TOAST, { text, act: act || null, label, error, shown: true, n: TOAST.n + 1 })
  clearTimeout(timer)
  timer = window.setTimeout(
    () => {
      TOAST.shown = false
      if (error) failedRetry.length = 0
      bump('toast')
    },
    ms || (error ? 8000 : act ? 5000 : 2600),
  )
  bump('toast')
}
export function hideToast() {
  TOAST.shown = false
  bump('toast')
}
export const hint = (t: string) => toast(t) // a key that can't act here says why, in a few words (T113 B26)
