// The voice's part of the page, made together: voice notes in the box, voice comments on a document, and speaking
// into a document being edited.

import type { Core } from '../core'
import type { DocsArea } from '../docs/area'
import type { InputsArea } from '../inputs/area'
import { Dictation } from './dictation'
import { DocVoice } from './docVoice'
import { Voice } from './voice'

export function makeVoice(c: Core, i: InputsArea, d: DocsArea) {
  const { s, toasts } = c
  const voice = new Voice({
    api: c.api,
    store: s.recording,
    box: i.box,
    boxStore: s.box,
    outbox: s.outbox,
    toasts,
    fields: c.fields,
    desk: c.desk,
    send: (sl, key) => i.draftSender.send(sl, key),
    boxKey: () => s.box.getState().shown.key,
    flush: () => void i.inputs.flush(),
    push: (o) => void i.inputs.push(o),
    keep: i.keep,
    goDraft: i.goDraft,
    about: (a) => docVoice.about(a.d, a.key, a.quote),
    delivery: c.delivery,
  })
  const docVoice = new DocVoice({
    voice,
    docs: d.docs,
    comments: d.docComments,
    box: i.box,
    boxStore: s.box,
    recording: s.recording,
    view: s.docView,
    runner: c.runner,
    toasts,
    model: c.model,
    desk: c.desk,
    reply: (sl, key, scope) => void i.box.send(sl, c.model(sl), scope, key),
  })
  const dictation = new Dictation({ api: c.api, delivery: c.delivery, store: s.dictation, view: s.docView, route: s.route, editor: d.docEditor, fields: c.fields, toasts, model: c.model, recording: c.recording, desk: c.desk })
  return { voice, docVoice, dictation }
}
export type VoiceArea = ReturnType<typeof makeVoice>
