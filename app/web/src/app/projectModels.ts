// A project as the page shows it: Taska's copy with your changes on their way laid over it, made once per copy and
// list of changes.

import { project, type ProjectModel, type ServerCopy } from '../model/project'
import type { ChangesStore } from '../stores/changes'
import type { DataStore } from '../stores/data'

export class ProjectModels {
  private readonly memo = new Map<string, { copy: ServerCopy; pending: unknown; model: ProjectModel }>()
  private readonly d: { data: DataStore; changes: ChangesStore }
  constructor(d: { data: DataStore; changes: ChangesStore }) {
    this.d = d
  }

  /** null until its data comes */
  of = (slug: string): ProjectModel | null => {
    const copy = this.d.data.getState().copies[slug]
    if (!copy) return null
    const pending = this.d.changes.getState().list
    const hit = this.memo.get(slug)
    if (hit && hit.copy === copy && hit.pending === pending) return hit.model
    const mine = pending.filter((c) => c.slug === slug)
    const m = project(copy, mine.flatMap((c) => c.patches), Math.max(copy.at, ...mine.map((c) => c.t)), mine.flatMap((c) => c.inputPatches || []), mine.flatMap((c) => c.docPatches || []))
    this.memo.set(slug, { copy, pending, model: m })
    return m
  }
}
