// A draft sent from wherever you are (a voice note stopped with Send): to what it is written to. A document's box:
// its voice comments, or a comment; the box shown now: sent as the box sends; another item's or the new input's: a
// reply to that item, or a new input.

import { draftTarget, type DraftKey } from '../../model/draftTarget'
import type { ProjectModel } from '../../model/project'
import type { BoxStore } from '../../stores/box'
import type { Box } from './box'
import type { DocVoice } from '../voice/docVoice'
import type { InputSender } from './inputSender'

export interface DraftSenderDeps {
  box: Box
  boxStore: BoxStore
  inputs: InputSender
  docVoice(): DocVoice
  model(slug: string): ProjectModel | null
}

export class DraftSender {
  private readonly d: DraftSenderDeps
  constructor(d: DraftSenderDeps) {
    this.d = d
  }

  send(slug: string, key: DraftKey): void {
    const t = draftTarget(key)
    if (t.kind === 'doc') return void this.d.docVoice().send(slug, t.d, key)
    const scope = t.kind === 'reply' ? t.code : null
    if (key === this.d.boxStore.getState().shown.key) return void this.d.box.send(slug, this.d.model(slug), scope)
    const { text, files } = this.d.box.take(slug, key)
    this.d.inputs.push({ slug, text, scope, files: files.map(({ key: k, ...f }) => ({ ...f, key: k })) })
  }
}
