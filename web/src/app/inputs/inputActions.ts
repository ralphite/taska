// What you do to something you said: organize it again (after the organizer failed, or after you undid what it
// filed), take back what it filed (and put it back), put it with another item, take a file off it, delete it (and
// restore it), move it to another project. Each shows at once and goes out as a change, sent again until Taska has
// it; a toast says what happened, with Undo where there is one.

import type { TaskaApi } from '../../api/taska'
import type { InputPatch, ProjectModel } from '../../model/project'
import type { DeletedInput } from '../../model/types'
import { inputCode } from '../../model/words'
import { newId, type ChangeRunner } from '../changeRunner'
import type { Toasts } from '../page/toasts'

export class InputActions {
  private readonly d: { runner: ChangeRunner; toasts: Toasts; api: TaskaApi; model(slug: string): ProjectModel | null; refresh(slug: string): void; title(slug: string): string; go(url: string): void }
  constructor(d: InputActions['d']) {
    this.d = d
  }

  /** `refusedSay`: a refusal is said in red (in Taska's words, or these), not listed as not saved */
  private send(slug: string, op: Record<string, unknown>, said: string, inputPatches: InputPatch[] = [], refusedSay?: string) {
    return this.d.runner.send({ id: newId(), slug, commands: [op as never], patches: [], inputPatches, said, t: Date.now(), ...(refusedSay ? { refusedSay } : {}) })
  }

  organizeAgain(slug: string, id: string): void {
    void this.send(slug, { op: 'organize-again', id }, `organizing ${inputCode(id)} again`)
  }

  remove(slug: string, id: string): void {
    void this.send(slug, { op: 'delete', id }, `deleting ${inputCode(id)}`, [{ id, f: {}, gone: true }])
    const undo = this.d.toasts.undoable(`${inputCode(id)} deleted`, async () => {
      const ok = await this.send(slug, { op: 'restore', id }, `restoring ${inputCode(id)}`)
      if (!ok) return false
      const x = this.d.model(slug)?.facts.deletedInputs.find((y) => y.id === id)
      this.d.toasts.show(`${inputCode(id)} is back${x?.items.length ? ` with ${x.items.map((i) => i.code).join(', ')}` : ''}`)
      return true
    })
    this.d.toasts.show(`Deleted ${inputCode(id)}`, undo)
  }

  /** Back from Deleted, with the items only it made; Undo deletes it again. */
  async restore(slug: string, id: string): Promise<void> {
    const x = this.d.model(slug)?.facts.deletedInputs.find((y) => y.id === id)
    if (!(await this.send(slug, { op: 'restore', id }, `restoring ${inputCode(id)}`))) return
    const undo = this.d.toasts.undoable(`${inputCode(id)} restored`, async () => {
      const ok = await this.send(slug, { op: 'delete', id }, `deleting ${inputCode(id)}`, [{ id, f: {}, gone: true }])
      if (ok) this.d.toasts.show(deletedSaid(this.d.model(slug)?.facts.deletedInputs.find((y) => y.id === id), id))
      return ok
    })
    this.d.toasts.show(`${inputCode(id)} is back${x?.items.length ? ` with ${x.items.map((i) => i.code).join(', ')}` : ''}`, undo)
  }

  undoFiling(slug: string, id: string): void {
    const what = this.d.model(slug)?.byId.get(id)?.filing?.what
    void this.send(slug, { op: 'filing-undo', id }, `undoing the filing of ${inputCode(id)}`, [], 'Could not undo').then((ok) => {
      if (!ok) return
      const back = this.d.toasts.undoable(`Filing of ${inputCode(id)} undone`, async () => {
        const done = await this.send(slug, { op: 'filing-redo', id }, `restoring the filing of ${inputCode(id)}`, [], 'Could not restore')
        if (done) this.d.toasts.show(`Restored ${inputCode(id)}’s filing`)
        return done
      })
      this.d.toasts.show(`Undid the filing of ${inputCode(id)}${what ? `: ${what}` : ''}`, back)
    })
  }

  rescope(slug: string, id: string, to: string, was: string | null): void {
    const n = Number(/\d+/.exec(to)?.[0])
    void this.send(slug, { op: 'rescope', id, to }, `putting ${inputCode(id)} with ${to}`, [{ id, f: { scope: n } }])
    const undo = was
      ? this.d.toasts.undoable(`${inputCode(id)} moved`, async () => {
          const ok = await this.send(slug, { op: 'rescope', id, to: was }, `putting ${inputCode(id)} back with ${was}`)
          if (ok) this.d.toasts.show(`${inputCode(id)} is back with ${was}`)
          return ok
        })
      : null
    this.d.toasts.show(`${inputCode(id)} now goes with ${to}`, undo)
  }

  takeOff(slug: string, id: string, f: string): void {
    const files = this.d.model(slug)?.byId.get(id)?.files.filter((x) => x.f !== f)
    void this.send(slug, { op: 'unfile', id, f }, 'taking a file off', files ? [{ id, f: { files } }] : [])
    this.d.toasts.show('File taken off')
  }

  async move(slug: string, id: string, to: string): Promise<boolean> {
    try {
      const r = await this.d.api.moveInput(slug, to, id)
      if (!r.ok) {
        this.d.toasts.show('Could not move it', null, { error: true })
        return false
      }
      this.d.refresh(slug)
      this.d.toasts.show(`Moved ${inputCode(id)} to ${this.d.title(to)} as ${inputCode(r.as)}`, () => this.d.go(`/p/${encodeURIComponent(to)}/`), { label: 'Open' })
      return true
    } catch (ex) {
      this.d.toasts.show((ex as Error).message || 'Could not move it', null, { error: true })
      return false
    }
  }
}

/** What deleting an input took with it, and what it kept (made from other inputs too). */
export function deletedSaid(x: DeletedInput | undefined, id: string): string {
  if (!x) return `Deleted ${inputCode(id)}`
  const k = x.kept
  return `Deleted ${inputCode(id)}${x.items.length ? ` and ${x.items.map((i) => i.code).join(', ')}` : ''}${k.length ? ` · ${k[0].code} kept: ${k[0].why}${k.length > 1 ? ` · ${k.length - 1} more kept` : ''}` : ''}`
}
