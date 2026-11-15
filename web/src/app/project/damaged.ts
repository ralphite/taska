// T806 #3: a change Taska could not read or apply when it opened a project is skipped, so the project still opens; what
// it changed is then missing from the page. The page says so once per project, so it is looked into, not missed.

import { plural } from '../../model/words'
import type { DataStore } from '../../stores/data'
import type { Toasts } from '../page/toasts'

export function watchDamaged(d: { data: DataStore; toasts: Pick<Toasts, 'show'> }): () => void {
  const told = new Set<string>()
  const look = () => {
    for (const [slug, copy] of Object.entries(d.data.getState().copies)) {
      const n = copy.facts?.damaged ?? 0
      if (n > 0 && !told.has(slug)) {
        told.add(slug)
        d.toasts.show(`${plural(n, 'change')} in ${copy.facts.title || slug} could not be read · some may be missing`, null, { error: true })
      }
    }
  }
  look()
  return d.data.subscribe((s, was) => void (s.copies !== was.copies && look()))
}
