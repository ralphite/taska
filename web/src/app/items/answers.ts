// Answering an agent's question by its choices: what is picked (here, or before a reload: kept by their words), and
// sending the answer, which goes out like anything you write (at once on the screen, kept and sent again until
// Taska has it). Answered again: the agent is told which answer this replaces.

import { choiceLabels } from '../../model/markdown'
import { codeOf, type ProjectModel } from '../../model/project'
import { answerOf, askRowOf } from '../../model/talk'
import type { Item } from '../../model/types'
import type { ItemViewStore } from '../../stores/itemView'
import type { OutboxStore } from '../../stores/outbox'
import type { InputSender } from '../inputs/inputSender'
import type { Box } from '../inputs/box'
import { replyDraft } from '../../model/draftTarget'

export class Answers {
  private readonly d: { inputs: InputSender; view: ItemViewStore; outbox: OutboxStore; box: Pick<Box, 'send'> }
  constructor(d: Answers['d']) {
    this.d = d
  }

  /** The question being answered on the item: its open question, or one answered being answered again. */
  question(it: Item) {
    const reask = this.d.view.getState().reask
    return reask != null ? it.thread.find((x) => x.id === reask) : it.wait?.kind === 'ask' ? it.wait : null
  }

  labels(it: Item): string[] {
    const q = this.question(it)
    return q ? choiceLabels(q.text) : []
  }

  picked(it: Item): ReadonlySet<number> {
    const v = this.d.view.getState()
    if (v.choice?.n === it.n) return v.choice.picked
    const kept = v.kept
    if (kept?.n !== it.n) return new Set()
    return new Set(this.labels(it).flatMap((l, i) => (kept.labels.includes(l) ? [i] : [])))
  }

  pick(it: Item, i: number, multi: boolean): void {
    this.d.view.getState().pick(it.n, i, multi, this.picked(it), this.labels(it))
  }

  /** An answer to the item's question still on its way: its words. */
  going(m: ProjectModel, slug: string, n: number) {
    return this.d.outbox.getState().list.filter((o) => o.slug === slug && o.scope === codeOf(m, n) && o.kind === 'answer').at(-1) ?? null
  }

  /** The choices picked on the item's question, as the answer says them, to go with what is in the box (B145);
   * null when none is picked (or its questions in a row answer on their card, B749). */
  picks(m: ProjectModel, slug: string, it: Item): { text: string; done(): void } | null {
    if (askRowOf(it.thread, it.wait?.id)) return null
    const chosen = [...this.picked(it)].sort((a, b) => a - b)
    if (!chosen.length) return null
    const labels = this.labels(it)
    const reask = this.d.view.getState().reask
    const x = reask != null ? it.thread.find((y) => y.id === reask) : undefined
    const was = x ? answerOf(it.thread, x, this.going(m, slug, it.n)?.text ?? null) || [] : []
    const text = chosen.map((i) => '✓ ' + labels[i]).join('\n') + (was.length ? `\n\nChanged my answer (it was: ${was.join(', ')})` : '')
    return { text, done: () => this.d.view.getState().endAnswer() }
  }

  /** Send the answer: the choices picked, and what is written in the item's box with them (B145). */
  send(m: ProjectModel, slug: string, it: Item): boolean {
    const answer = this.picks(m, slug, it)
    if (!answer) return false
    const code = codeOf(m, it.n)
    return this.d.box.send(slug, m, code, replyDraft(code), answer)
  }

  /** Your answers to some of the questions in a row (`of`), as one reply; the others keep waiting (B749). */
  sendRow(m: ProjectModel, slug: string, it: Item, of: number[], text: string): void {
    this.d.inputs.push({ slug, text, files: [], scope: codeOf(m, it.n), quiet: true, kind: 'answer', of })
  }
}
