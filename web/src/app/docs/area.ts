// The documents' part of the page, made together: a document as you read it, the document itself as you edit it,
// the project's rules, comments on documents and their choices. Speaking into a document being edited (the voice's
// part, made after it) is reached through `dictation`.

import type { Core } from '../core'
import type { InputsArea } from '../inputs/area'
import type { Dictation } from '../voice/dictation'
import { DocChoices } from './choices'
import { DocComments } from './comments'
import { Docs } from './docs'
import { DocEditor } from './editor'
import { Rules } from './rules'

export function makeDocs(c: Core, i: Pick<InputsArea, 'box' | 'inputs'>, dictation: () => Dictation) {
  const { s, toasts, runner, sheets, fields } = c
  const docs = new Docs({ route: s.route, model: c.model, view: s.docView, nav: c.nav, fields, toasts, desk: c.desk, leaveEditor: () => docEditor.keep() })
  const docEditor: DocEditor = new DocEditor({
    route: s.route,
    model: c.model,
    runner,
    view: s.docView,
    sheets,
    toasts,
    kv: c.kv,
    desk: c.desk,
    open: (dn) => docs.open(dn),
    close: () => docs.close(),
    mic: { discard: (key) => dictation().discard(key), settled: () => dictation().settled() },
  })
  const rules = new Rules({ route: s.route, model: c.model, runner, view: s.docView, nav: c.nav, sheets, toasts, kv: c.kv })
  const docComments = new DocComments({ route: s.route, model: c.model, runner, view: s.docView, box: i.box, boxStore: s.box, fields, sheets, toasts, desk: c.desk })
  const docChoices = new DocChoices({ route: s.route, model: c.model, runner, ticks: s.docTicks, view: s.docView, box: i.box, inputs: i.inputs, toasts, desk: c.desk })
  return { docs, docEditor, rules, docComments, docChoices }
}
export type DocsArea = ReturnType<typeof makeDocs>
