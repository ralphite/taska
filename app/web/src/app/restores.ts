// Bringing back what was deleted (an item with its subitems, a document, an input), and undoing one of your older
// changes from the change log. Each waits for Taska, then says so. A second press right after the first does nothing.

import type { ProjectModel } from '../model/project'
import { undoLabel } from '../model/activity'
import { newId, type ChangeRunner } from './changeRunner'
import type { InputActions } from './inputActions'
import type { Toasts } from './toasts'

export class Restores {
  private readonly d: { runner: ChangeRunner; toasts: Toasts; inputs: InputActions; model(slug: string): ProjectModel | null }
  private at = 0
  constructor(d: Restores['d']) {
    this.d = d
  }

  private justNow(): boolean {
    const now = Date.now()
    const was = now - this.at < 700
    this.at = now
    return was
  }

  private send(slug: string, command: Record<string, unknown>, said: string) {
    return this.d.runner.send({ id: newId(), slug, commands: [command as never], patches: [], said, t: Date.now() })
  }

  async item(slug: string, ref: string): Promise<void> {
    if (this.justNow()) return
    if (await this.send(slug, { op: 'iundel', ref }, `restoring ${ref}`)) this.d.toasts.show(`${ref} is back`)
  }

  async doc(slug: string, d: number): Promise<void> {
    if (this.justNow()) return
    if (await this.send(slug, { op: 'ddel', d, on: false }, `restoring D${d}`)) this.d.toasts.show(`D${d} is back`)
  }

  input(slug: string, id: string): void {
    if (this.justNow()) return
    void this.d.inputs.restore(slug, id)
  }

  /** One of your changes, put back as it was. */
  async revert(slug: string, seq: number): Promise<void> {
    const m = this.d.model(slug)
    const u = m?.facts.undo.find((x) => x.seq === seq)
    if (await this.send(slug, { op: 'revert', seq }, 'undoing a change')) this.d.toasts.show(`Undid: ${u && m ? undoLabel(m, u) : 'the change'}`)
  }
}
