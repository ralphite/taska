// An item going to another project: it leaves this one at once (with its subitems: here they show won't do and
// archived), and Taska is told behind you, asked again while it cannot be reached; it comes back, with why, only
// when the move finally cannot be done. The toast's Open goes to it there.

import { Unreachable } from '../api/http'
import type { TaskaApi } from '../api/taska'
import { codeOf, type ProjectModel } from '../model/project'
import { plural } from '../model/words'
import type { ChangesStore } from '../stores/changes'
import { newId } from './changeRunner'
import type { Toasts } from './toasts'

export class Moves {
  private readonly d: { api: TaskaApi; changes: ChangesStore; toasts: Toasts; model(slug: string): ProjectModel | null; title(slug: string): string; go(url: string): void; refresh(slug: string): void }
  constructor(d: Moves['d']) {
    this.d = d
  }

  async item(slug: string, n: number, to: string): Promise<boolean> {
    const m = this.d.model(slug)
    if (!m) return false
    const ref = codeOf(m, n)
    const tree: number[] = []
    for (let k = [n]; k.length; k = k.flatMap((x) => (m.kids.get(x) || []).map((it) => it.n))) tree.push(...k)
    const id = newId()
    // shown at once: here they are finished and archived
    this.d.changes.getState().add({ id, slug, commands: [], patches: tree.map((k) => ({ n: k, f: { status: 'dropped', archived: true } })), said: `moving ${ref}`, t: Date.now(), showOnly: true })
    const got = { as: '' }
    const done = (async () => {
      for (let i = 0; ; i++) {
        try {
          const r = await this.d.api.moveItem(slug, to, ref, id)
          if (!r.ok) throw new Error('Taska said no')
          got.as = r.as
          this.d.refresh(slug)
          return true
        } catch (ex) {
          if (!(ex instanceof Unreachable) || i >= 20) {
            this.d.toasts.show(`Not saved: moving ${ref} to ${this.d.title(to)} (it is back here): ${ex instanceof Unreachable ? 'Taska unreachable' : (ex as Error).message || 'Taska said no'}`, null, { error: true })
            return false
          }
          await new Promise((ok) => setTimeout(ok, Math.min(30000, 1000 * 2 ** Math.min(i, 4))))
        }
      }
    })()
    void done.finally(() => this.d.changes.getState().remove(id))
    this.d.toasts.show(`Moved ${ref} to ${this.d.title(to)}` + (tree.length > 1 ? ` with its ${plural(tree.length - 1, 'subitem')}` : ''), async () => {
      if (await done) this.d.go(`/p/${encodeURIComponent(to)}/${got.as}`)
    }, { label: 'Open' })
    return done
  }
}
