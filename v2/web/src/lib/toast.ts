// What just happened, in one line (T160). With `act` it carries a button for a few seconds: Undo, or `label`. An
// error is red, is read out at once (role=alert) and stays longer.
import { bump, ctx } from './state'
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
  sid: string // its key in this browser's list (A2, T422)
  what: string
  why: string
  at: number
  retry: (() => unknown) | null
  p: string
  go?: string // B527: where it belongs (an item, a document, the inputs), to go and see
  said?: string // B527: the words it carried, so you know which one it was
}
type Stored = { sid: string; what: string; why: string; at: number; p: string; go?: string; said?: string }
export const FAILED: Failed[] = []
let fid = 0
export const nextFailedId = () => ++fid
// A2 (T422): the list is kept in this browser too, so a reload does not lose what was not saved
const FKEY = 'taska.failed'
export function failedStore(change?: (all: Stored[]) => Stored[]): Stored[] {
  try {
    let all = JSON.parse(localStorage.getItem(FKEY) || '[]') as Stored[]
    if (change) {
      all = change(all)
      if (all.length) localStorage.setItem(FKEY, JSON.stringify(all.slice(-50)))
      else localStorage.removeItem(FKEY)
    }
    return all
  } catch {
    return []
  }
}
export function addFailed(
  what: string,
  why: string,
  retry: (() => unknown) | null = null,
  p = ctx.P,
  more: { go?: string; said?: string } = {},
) {
  const f: Failed = { id: ++fid, sid: Date.now().toString(36) + fid, what, why, at: Date.now(), retry, p, ...more }
  FAILED.unshift(f)
  failedStore((all) => [...all, { sid: f.sid, what, why, at: f.at, p, ...more }])
  toast(retry ? `Not saved yet: ${what}. Saves when Taska is back` : `Not saved: ${what}: ${why}`, null, {
    error: !retry,
  })
  bump('head', 'dialog')
  return f
}
/** Send it again (it leaves the list; if it fails again it comes back). Without an id: all of them, oldest first. */
export function retryFailed(id?: number) {
  const go = FAILED.filter((f) => f.retry && (id === undefined || f.id === id)).reverse()
  for (const f of go) dropFailed(f.id)
  for (const f of go) void f.retry?.()
}
export function dropFailed(id?: number) {
  const gone = new Set<string>()
  for (let i = FAILED.length - 1; i >= 0; i--)
    if (id === undefined || FAILED[i].id === id) gone.add(FAILED.splice(i, 1)[0].sid)
  failedStore((all) => all.filter((e) => !gone.has(e.sid)))
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
