// A task going to another project: it leaves this one at once (with its subtasks: here they show won't do and
// archived), and Taska is told behind you, asked again until it answers (api/delivery); it comes back, with why, only
// when Taska says no. The toast's Open goes to it there, and what you wrote in its box and did not send yet goes along
// (B799, B408): the words into its box there, its voice notes and files back into it when it opens there.

import type { Delivery } from '../../api/delivery'
import type { TaskaApi } from '../../api/taska'
import { REACH_WORDS } from '../../model/reach'
import { codeOf, type ProjectModel } from '../../model/project'
import { plural } from '../../model/words'
import { movedTask } from '../../model/optimistic'
import { newId, type ChangeRunner } from '../changeRunner'
import type { Toasts } from '../page/toasts'
import type { BoxStore, DraftFile } from '../../stores/box'
import type { DraftsStore } from '../../stores/drafts'
import { replyDraft, type DraftKey } from '../../model/draftTarget'

export class Moves {
  private readonly d: {
    api: TaskaApi
    delivery: Delivery
    runner: ChangeRunner
    toasts: Toasts
    model(slug: string): ProjectModel | null
    title(slug: string): string
    go(url: string): void
    refresh(slug: string): void
    drafts: DraftsStore
    box: BoxStore
    /** a draft's files kept for its draft in another project (inputs/keptNotes) */
    carry(files: readonly DraftFile[], to: string, key: DraftKey): void
  }
  constructor(d: Moves['d']) {
    this.d = d
  }

  async task(slug: string, n: number, to: string): Promise<boolean> {
    const m = this.d.model(slug)
    if (!m) return false
    const ref = codeOf(m, n)
    const id = newId()
    // shown at once: here they are finished and archived
    const moved = movedTask(m, n)
    const shown = { patches: moved.patches, remove: this.d.runner.show(slug, moved) }
    const got = { as: '' }
    const done = (async () => {
      try {
        const r = await this.d.delivery.until(() => this.d.api.moveTask(slug, to, ref, id), { waiting: () => this.d.toasts.show(REACH_WORDS.waits) })
        if (!r.ok) throw new Error('Taska said no')
        got.as = r.as
        this.takeDraft(slug, ref, to, r.as)
        this.d.refresh(slug)
        return true
      } catch (ex) {
        this.d.toasts.show(`Couldn't move ${ref} to ${this.d.title(to)}: ${(ex as Error).message || 'Taska said no'}`, null, { error: true })
        return false
      }
    })()
    void done.finally(shown.remove)
    const more = shown.patches.length - 1
    this.d.toasts.show(`Moved ${ref} to ${this.d.title(to)}` + (more > 0 ? ` with its ${plural(more, 'subtask')}` : ''), async () => {
      if (await done) this.d.go(`/p/${encodeURIComponent(to)}/${got.as}`)
    }, { label: 'Open' })
    return done
  }

  /** What was written in the task's box here goes to its box there (`as`: its code there). */
  private takeDraft(slug: string, ref: string, to: string, as: string): void {
    if (!as) return
    const from = replyDraft(ref)
    const there = replyDraft(as)
    const drafts = this.d.drafts.getState()
    const text = drafts.of(slug)[from] || ''
    if (text.trim()) {
      const was = drafts.of(to)[there] || ''
      drafts.set(to, there, was.trim() ? was.trimEnd() + '\n\n' + text : text)
    }
    if (text) drafts.set(slug, from, '')
    const box = this.d.box.getState()
    if (box.slug === slug && box.files[from]?.length) this.d.carry(box.takeFiles(from), to, there)
  }
}
