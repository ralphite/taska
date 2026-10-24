// Where a draft belongs, to go to it ("Go there", "Open"): the New input page, an item's box, a document, the box on
// one of your inputs (an edit, details added, a correction), one of your comments being edited. What it was for is
// gone: it says which, never a Go there that does nothing.

import { allComments } from '../model/docs'
import { draftName, draftTarget, type DraftKey } from '../model/draftTarget'
import { codeOf, type ProjectModel } from '../model/project'
import { inTab, tabOf } from '../model/visible'
import type { RouteStore } from '../stores/route'
import type { Box } from './box'
import type { Docs } from './docs'
import type { Fields } from './fields'
import type { Navigation } from './navigation'
import type { Toasts } from './toasts'

export interface DraftPlacesDeps {
  route: RouteStore
  nav: Navigation
  box: Box
  docs(): Docs | null
  fields: Fields
  toasts: Toasts
  slug(): string
  model(slug: string): ProjectModel | null
}

export class DraftPlaces {
  private readonly d: DraftPlacesDeps
  constructor(d: DraftPlacesDeps) {
    this.d = d
  }

  go(key: DraftKey): void {
    const slug = this.d.slug()
    const m = this.d.model(slug)
    const t = draftTarget(key)
    switch (t.kind) {
      case 'new':
        return this.d.nav.newInput()
      case 'doc':
        if (m?.docs.some((x) => x.d === t.d)) return this.d.docs()?.open(t.d)
        break
      case 'amend':
        if (!m?.byId.has(t.id)) return this.d.toasts.show('Input no longer exists', null, { error: true })
        this.d.nav.newInput()
        return this.d.box.amendStart(slug, m, t.id, t.mode)
      case 'reply': {
        const n = Number(t.code.slice(1))
        const it = m?.byN.get(n)
        if (!m || !it) break
        const r = this.d.route.getState().route
        this.d.nav.openItem(codeOf(m, n), inTab(it, r.page === 'project' ? r.tab : 'items') ? undefined : tabOf(it))
        return this.d.fields.focus('box')
      }
      case 'correct': {
        const fix = m?.byId.get(t.id)
        if (!fix) break
        this.d.nav.newInput()
        this.d.box.correctStart(fix.id, '', fix.v || 0, false)
        return this.d.fields.focus('box')
      }
      case 'comment': {
        const doc = m?.docs.find((x) => (t.d == null || x.d === t.d) && allComments(x).some((c) => c.id === t.id))
        if (!doc) break
        this.d.docs()?.open(doc.d)
        return this.d.docs()?.editComment(slug, doc.d, t.id)
      }
    }
    this.d.toasts.show(`${draftName(key).replace(/^the /, 'The ')} is gone`, null, { error: true })
  }
}
