// What the document services share: where you are (the project shown and its model) and a change to a document,
// shown at once and saved behind you.

import { newId, type ChangeRunner } from '../changeRunner'
import type { DocPatch, ProjectModel } from '../../model/project'
import type { RouteStore } from '../../stores/route'

export interface DocPlace {
  route: RouteStore
  model(slug: string): ProjectModel | null
}

/** the project shown, with its model (null: none, or its data not here yet) */
export function docHere(d: DocPlace) {
  const r = d.route.getState().route
  if (r.page !== 'project') return null
  const m = d.model(r.slug)
  return m ? { r, m, slug: r.slug } : null
}

/** a document's change, shown at once (`docPatches`) and saved behind you -> it was saved */
export function docSend(d: { runner: ChangeRunner }, slug: string, command: Record<string, unknown>, said: string, docPatches: DocPatch[] = []): Promise<boolean> {
  return d.runner.send({ id: newId(), slug, commands: [command as never], patches: [], docPatches, said, t: Date.now() })
}
