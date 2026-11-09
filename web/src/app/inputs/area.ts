// The inputs' part of the page, made together: the box (its drafts and files), sending what you said (in order, until
// Taska has it), what was delivered, what you do to something you said, the other tabs' drafts, the voice notes and
// files kept over a reload, where a draft belongs, and sending a draft. What it reaches in the documents' and the
// voice's parts (made after it) it reaches through `links`.

import { memoryVault, type NoteVault } from '../../stores/noteVault'
import { draftName, type DraftKey } from '../../model/draftTarget'
import type { Core } from '../core'
import type { DocComments } from '../docs/comments'
import type { Docs } from '../docs/docs'
import type { DocVoice } from '../voice/docVoice'
import type { Voice } from '../voice/voice'
import { Box } from './box'
import { Delivered } from './delivered'
import { DraftPlaces } from './draftPlaces'
import { DraftSender } from './draftSender'
import { InputActions } from './inputActions'
import { InputSender } from './inputSender'
import { KeptNotes } from './keptNotes'
import { OtherTabs } from './otherTabs'

export interface InputLinks {
  voice(): Voice
  docVoice(): DocVoice
  docs(): Docs
  docComments(): DocComments
  /** voice notes and files not up yet, kept with their audio over a reload */
  vault?: NoteVault
}

export function makeInputs(c: Core, links: InputLinks) {
  const { s, toasts, runner } = c
  const keep = (blob: Blob) => keptNotes.keep(blob)
  const goDraft = (key: DraftKey) => draftPlaces.go(key)
  const delivered = new Delivered({ box: s.box, ui: s.ui, route: s.route, runner, toasts, fields: c.fields, model: c.model, slug: c.slug })
  const inputs = new InputSender(runner, s.outbox, {
    sent: (o, rid) => delivered.sent(o, rid),
    refused: (_o, why) => toasts.show(why ? `err: ${why}` : 'Not saved', null),
    log: () => {},
  })
  const inputActions = new InputActions({ runner, toasts, api: c.api, model: c.model, refresh: (sl) => c.project().stale(sl), title: c.title, go: c.go })
  // the other tabs of this browser: their drafts show here too
  const otherTabs = new OtherTabs({ kv: c.kv, drafts: s.drafts, box: s.box, toasts, slug: c.slug, recording: c.recording })
  const box = new Box({
    api: c.api,
    store: s.box,
    drafts: s.drafts,
    outbox: s.outbox,
    inputs,
    runner,
    toasts,
    keep,
    recording: c.recording,
    goDraft,
    model: c.model,
    kv: c.kv,
    sent: (sl, key) => otherTabs.sent(sl, key),
    refresh: (sl) => c.project().refresh(sl),
    replied: (sl, scope) => delivered.replied(sl, scope),
    delivery: c.delivery,
  })
  const draftSender = new DraftSender({ box, boxStore: s.box, inputs, docVoice: links.docVoice, model: c.model })
  const keptNotes: KeptNotes = new KeptNotes({
    vault: links.vault ?? memoryVault(),
    kv: c.kv,
    box: s.box,
    outbox: s.outbox,
    inputs,
    toasts,
    resume: (sl, key, f, blob, scope) => (f.plain ? box.resume(sl, f.key, blob, f.name) : links.voice().resume(sl, key, f, blob, scope)),
    place: (sl, key, f) => links.voice().placeKept(sl, key, f),
    draftName,
    goDraft,
    boxKey: () => s.box.getState().shown.key,
  })
  // where a draft belongs, to go there
  const draftPlaces: DraftPlaces = new DraftPlaces({
    route: s.route,
    nav: c.nav,
    box,
    docs: links.docs,
    comments: links.docComments,
    fields: c.fields,
    toasts,
    slug: c.slug,
    model: c.model,
  })
  return { inputs, delivered, inputActions, otherTabs, box, draftSender, keptNotes, draftPlaces, keep, goDraft }
}
export type InputsArea = ReturnType<typeof makeInputs>
