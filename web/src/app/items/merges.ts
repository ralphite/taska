// The item an address names, settled once its project is here: a merged item lives on in the one it went into (the
// item on screen, opened by its old code or merged while you look at it, gives way to that one, and says so; what
// you wrote for it goes along, after what is there); a code with the wrong letter reads as the item's own; an address
// opened as it is shows the list's tab the item is in (Archive, Rules).

import { codeOf, liveN, type ProjectModel } from '../../model/project'
import { tabOf } from '../../model/visible'
import type { Tab } from '../../model/words'
import type { BoxStore } from '../../stores/box'
import type { DataStore } from '../../stores/data'
import type { DraftsStore } from '../../stores/drafts'
import type { RouteStore } from '../../stores/route'
import type { Toasts } from '../page/toasts'
import { draftKey, draftTarget, replyDraft } from '../../model/draftTarget'

export interface MergesDeps {
  route: RouteStore
  data: DataStore
  drafts: DraftsStore
  box: BoxStore
  toasts: Toasts
  model(slug: string): ProjectModel | null
  /** the item, in place of the one shown (no step Back), with the list's tab */
  showItem(code: string, tab: Tab): void
  goDraft(key: string): void
}

export class Merges {
  private readonly d: MergesDeps
  readonly stop: () => void
  constructor(d: MergesDeps) {
    this.d = d
    // settled again when the project shown comes or changes, and when where you are changes
    const undata = d.data.subscribe((s, was) => {
      const r = d.route.getState().route
      if (r.page === 'project' && s.copies[r.slug] !== was.copies[r.slug]) this.settle()
    })
    const unroute = d.route.subscribe((s, was) => s.route !== was.route && this.settle())
    this.stop = () => {
      undata()
      unroute()
    }
  }

  /** The project shown changed, or where you are in it. */
  settle(): void {
    const st = this.d.route.getState()
    const r = st.route
    if (r.page !== 'project') return
    const m = this.d.model(r.slug)
    if (!m) return
    const moved = this.moveDrafts(r.slug, m)
    const n = r.place.kind === 'item' ? Number(/\d+/.exec(r.place.ref)?.[0]) : NaN
    const to = m.byN.get(n)?.mergedInto ? liveN(m, n) : n
    const live = m.byN.get(to)
    if (r.place.kind === 'item' && live) {
      const now = codeOf(m, to)
      const tab = st.tabKept ? r.tab : tabOf(live)
      if (now !== r.place.ref || tab !== r.tab || !st.tabKept) this.d.showItem(now, tab)
    }
    if (to !== n && live) {
      const was = codeOf(m, n)
      this.d.toasts.show(`${was} was merged into ${codeOf(m, to)}${moved.some(([f]) => f === was) ? '. What you wrote for it is in this box now' : ''}`)
    } else if (moved.length)
      this.d.toasts.show(`${moved.map(([f, t]) => `${f} → ${t}`).join(', ')}: merged, and what you wrote went along`, () => this.d.goDraft(moved[0][1]), { label: 'Go there' })
  }

  /** Drafts for merged items go to the items they went into. -> [from, to] codes */
  private moveDrafts(slug: string, m: ProjectModel): [string, string][] {
    const words = this.d.drafts.getState().of(slug)
    const box = this.d.box.getState()
    const files = box.slug === slug ? box.files : {}
    const moved: [string, string][] = []
    for (const stored of new Set([...Object.keys(words), ...Object.keys(files)])) {
      const t = draftTarget(stored)
      if (t.kind !== 'reply') continue
      const key = draftKey(t)
      const n = Number(t.code.slice(1))
      if (!m.byN.get(n)?.mergedInto || liveN(m, n) === n) continue
      const to = replyDraft(codeOf(m, liveN(m, n)))
      const text = words[key] || ''
      const fs = files[key]?.length ? this.d.box.getState().takeFiles(key) : []
      if (text) this.d.drafts.getState().set(slug, key, '')
      if (!text.trim() && !fs.length) continue
      const was = this.d.drafts.getState().of(slug)[to] || ''
      this.d.drafts.getState().set(slug, to, was.trim() ? was.trimEnd() + '\n\n' + text : text)
      if (fs.length) {
        // after the files already there; where they were recorded in the words no longer holds
        const there = this.d.box.getState().takeFiles(to)
        this.d.box.getState().putFiles(to, [...there, ...fs.map((f) => ({ ...f, at: undefined }))])
      }
      moved.push([key, to])
    }
    return moved
  }
}
