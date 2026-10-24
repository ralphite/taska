// A document's choices: a tap ticks one on the page; they wait until Send choices, which puts them in the document
// and tells its item which you ticked (with what the box holds).

import { blockKeys } from '../../model/docs'
import { tickedBlock, tickText, tickWords, ticksOf } from '../../model/docTicks'
import { docDraft, replyDraft } from '../../model/draftTarget'
import { codeOf, liveN } from '../../model/project'
import type { DocTicksStore } from '../../stores/docTicks'
import type { DocViewStore } from '../../stores/docView'
import type { Box } from '../box'
import type { ChangeRunner } from '../changeRunner'
import type { InputSender } from '../inputSender'
import type { Toasts } from '../toasts'
import { docHere, docSend, type DocPlace } from './shared'

export interface DocChoicesDeps extends DocPlace {
  runner: ChangeRunner
  ticks: DocTicksStore
  view: DocViewStore
  box: Box
  inputs: InputSender
  toasts: Toasts
  desk(): boolean
}

export class DocChoices {
  private readonly d: DocChoicesDeps
  constructor(d: DocChoicesDeps) {
    this.d = d
  }

  /** Tick or untick the i-th choice of a paragraph. */
  tick(dn: number, k: string, i: number): void {
    const doc = docHere(this.d)?.m.docs.find((x) => x.d === dn)
    const keys = doc ? blockKeys(doc) : []
    const b = doc?.blocks[keys.indexOf(k)]
    const t = this.d.ticks.getState()
    const next = b ? tickedBlock(tickText(t, dn, k, b.text), i) : null
    if (!b || next == null) return this.d.toasts.show('Document changed; open it again', null, { error: true })
    t.set(dn, k, next === b.text ? null : next)
    if (!this.d.desk()) this.d.view.getState().setTyping(true) // the phone: the box comes under the document, with Send choices
  }

  /** A sent form made a form again, to change and send again. */
  modifyTicks(dn: number, k: string): void {
    this.d.ticks.getState().reopen(dn, k)
  }

  clearTicks(dn: number): void {
    this.d.ticks.getState().clear(dn)
  }

  /** Only the choices go into the document (as it is when they get there); the item hears which you ticked. */
  async sendTicks(slug: string, dn: number): Promise<void> {
    const m = this.d.model(slug)
    const doc = m?.docs.find((x) => x.d === dn)
    const t = this.d.ticks.getState()
    if (!m || !doc || !ticksOf(t, doc).length) return
    const n = liveN(m, doc.n)
    const sent = Object.fromEntries(ticksOf(t, doc).map(({ k, now }) => [k, now]))
    const words = tickWords(t, doc)
    if (m.byN.has(n)) {
      // what the box holds goes along (it writes to the item on the desktop, to the document on the phone)
      const { text: note, files } = this.d.box.take(slug, this.d.desk() ? replyDraft(codeOf(m, n)) : docDraft(dn))
      this.d.inputs.push({ slug, text: [`Answered in D${dn}:`, ...(words.length ? words : ['nothing ticked']), ...(note ? ['', note] : [])].join('\n'), scope: codeOf(m, n), files: files.map(({ key: fk, ...f }) => ({ ...f, key: fk })), kind: 'answer' })
      if (!this.d.desk()) this.d.toasts.show(`Choices sent to ${codeOf(m, n)}`)
    }
    if (!this.d.desk()) this.d.view.getState().setTyping(false)
    t.sentOff(dn, sent)
    const ticks = Object.entries(sent).map(([k, text]) => {
      const [bk, occ] = k.split('~')
      return { key: bk, occ: Number(occ) || 0, text }
    })
    const ok = await docSend(this.d, slug, { op: 'dticks', d: dn, ticks }, `sending choices in D${dn}`)
    this.d.ticks.getState().done(dn, sent, ok)
  }
}
