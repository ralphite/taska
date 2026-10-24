// Answering an agent's question by its choices: what is picked (here, or before a reload: kept by their words), and
// sending the answer, which goes out like anything you write (at once on the screen, kept and sent again until
// Taska has it). Answered again: the agent is told which answer this replaces.

import { choiceLabels } from '../model/markdown'
import { codeOf, type ProjectModel } from '../model/project'
import { answerOf } from '../model/talk'
import type { Item } from '../model/types'
import type { ItemViewStore } from '../stores/itemView'
import type { OutboxStore } from '../stores/outbox'
import type { InputSender } from './inputSender'

export class Answers {
  private readonly d: { inputs: InputSender; view: ItemViewStore; outbox: OutboxStore }
  constructor(d: { inputs: InputSender; view: ItemViewStore; outbox: OutboxStore }) {
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

  send(m: ProjectModel, slug: string, it: Item): boolean {
    const chosen = [...this.picked(it)].sort((a, b) => a - b)
    if (!chosen.length) return false
    const labels = this.labels(it)
    const reask = this.d.view.getState().reask
    const x = reask != null ? it.thread.find((y) => y.id === reask) : undefined
    const was = x ? answerOf(it.thread, x, this.going(m, slug, it.n)?.text ?? null) || [] : []
    const text = chosen.map((i) => '✓ ' + labels[i]).join('\n') + (was.length ? `\n\nChanged my answer (it was: ${was.join(', ')})` : '')
    this.d.inputs.push({ slug, text, files: [], scope: codeOf(m, it.n), quiet: true, kind: 'answer' })
    this.d.view.getState().endAnswer()
    return true
  }
}
