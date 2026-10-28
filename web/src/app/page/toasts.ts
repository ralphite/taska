// Showing what just happened: one toast at a time, gone after a few seconds (longer with a button, longer still for an
// error); a sticky one stays until you act on it. Every Undo on a toast is also your last undo step (Z).

import type { FeedbackStore, NotSaved, UndoStep } from '../../stores/feedback'
import type { PendingChange } from '../../stores/changes'
import { changePlace, changeText, changeWords } from '../../model/saidOf'

export interface ToastOptions {
  error?: boolean
  label?: string
  ms?: number
  sticky?: boolean
}

export class Toasts {
  private n = 0
  private timer = 0
  private readonly store: FeedbackStore
  private readonly logError: (text: string) => void
  constructor(store: FeedbackStore, logError: (text: string) => void = () => {}) {
    this.store = store
    this.logError = logError
  }

  show(text: string, action: UndoStep | (() => unknown) | null = null, o: ToastOptions = {}): void {
    const label = o.label ?? 'Undo'
    let run: (() => unknown) | null = null
    if (action) {
      if (typeof action === 'function') {
        run = label === 'Undo' ? this.undoable(text, async () => (await action()) !== false).run : action
      } else run = action.run
    }
    const id = ++this.n
    if (o.error || o.sticky) this.logError(text)
    this.store.getState().showToast({ id, text, action: run ? { label, run } : null, error: !!o.error, sticky: !!o.sticky })
    clearTimeout(this.timer)
    if (!o.sticky) this.timer = window.setTimeout(() => this.store.getState().hideToast(id), o.ms || (o.error ? 8000 : run ? 5000 : 2600))
  }

  /** `unlessSticky`: one that stays until you act on it stays. */
  hide(unlessSticky = false): void {
    if (unlessSticky && this.store.getState().toast?.sticky) return
    this.store.getState().hideToast()
  }

  /** An undo step: Z and the toast's Undo run it once; one that could not be put back can be tried again. */
  undoable(label: string, undo: () => Promise<boolean>): UndoStep {
    const id = ++this.n
    let done = false
    const step: UndoStep = {
      id,
      label,
      run: async () => {
        if (done) return true
        done = true
        this.store.getState().dropUndo(id)
        const ok = await undo()
        if (!ok) {
          done = false
          this.store.getState().pushUndo(step)
        }
        return ok
      },
    }
    this.store.getState().pushUndo(step)
    return step
  }

  forget(step: UndoStep | null | undefined): void {
    if (step) this.store.getState().dropUndo(step.id)
  }

  /** Taska said no: it is listed with why, and said once. */
  /** Sent again (one, or every one that can be): it leaves the list; failing again, it comes back. */
  retryNotSaved(sid?: string): void {
    const go = this.store.getState().notSaved.filter((f) => f.retry && (sid == null || f.sid === sid)).reverse()
    for (const f of go) this.store.getState().dropNotSaved(f.sid)
    for (const f of go) void f.retry?.()
  }

  /** A change Taska said no to: its sender answers it, or it is said in red in Taska's words (or the sender's), or it
   * is listed as not saved (what it was, where it belongs, its words). */
  changeRefused(c: PendingChange, why: string): void {
    if (c.ownRefusal) return
    if (c.refusedSay != null) return this.show(why || c.refusedSay, null, { error: true })
    this.notSaved({ what: changeWords(c.commands), why, slug: c.slug, go: changePlace(c.commands, c.slug), said: changeText(c.commands) })
  }

  notSaved(f: Omit<NotSaved, 'sid' | 'at'>): void {
    const sid = Date.now().toString(36) + ++this.n
    this.store.getState().addNotSaved({ ...f, sid, at: Date.now() })
    this.show(f.retry ? `Not saved yet: ${f.what}. Saves when Taska is back` : `Not saved: ${f.what}: ${f.why}`, null, { error: !f.retry })
  }
}
