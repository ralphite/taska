// An item going to another project: it leaves this one at once (with its subitems: here they show won't do and
// archived), and Taska is told behind you, asked again until it answers (api/delivery); it comes back, with why, only
// when Taska says no. The toast's Open goes to it there.

import type { Delivery } from '../../api/delivery'
import type { TaskaApi } from '../../api/taska'
import { REACH_WORDS } from '../../model/reach'
import { codeOf, type ProjectModel } from '../../model/project'
import { plural } from '../../model/words'
import { movedItem } from '../../model/optimistic'
import { newId, type ChangeRunner } from '../changeRunner'
import type { Toasts } from '../page/toasts'

export class Moves {
  private readonly d: { api: TaskaApi; delivery: Delivery; runner: ChangeRunner; toasts: Toasts; model(slug: string): ProjectModel | null; title(slug: string): string; go(url: string): void; refresh(slug: string): void }
  constructor(d: Moves['d']) {
    this.d = d
  }

  async item(slug: string, n: number, to: string): Promise<boolean> {
    const m = this.d.model(slug)
    if (!m) return false
    const ref = codeOf(m, n)
    const id = newId()
    // shown at once: here they are finished and archived
    const moved = movedItem(m, n)
    const shown = { patches: moved.patches, remove: this.d.runner.show(slug, moved) }
    const got = { as: '' }
    const done = (async () => {
      try {
        const r = await this.d.delivery.until(() => this.d.api.moveItem(slug, to, ref, id), { waiting: () => this.d.toasts.show(REACH_WORDS.waits) })
        if (!r.ok) throw new Error('Taska said no')
        got.as = r.as
        this.d.refresh(slug)
        return true
      } catch (ex) {
        this.d.toasts.show(`Couldn't move ${ref} to ${this.d.title(to)}: ${(ex as Error).message || 'Taska said no'}`, null, { error: true })
        return false
      }
    })()
    void done.finally(shown.remove)
    const more = shown.patches.length - 1
    this.d.toasts.show(`Moved ${ref} to ${this.d.title(to)}` + (more > 0 ? ` with its ${plural(more, 'subitem')}` : ''), async () => {
      if (await done) this.d.go(`/p/${encodeURIComponent(to)}/${got.as}`)
    }, { label: 'Open' })
    return done
  }
}
