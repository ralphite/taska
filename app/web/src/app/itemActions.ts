// One-tap changes to an item (a row's pill or quick action, a swipe, a key, the item's buttons): they show at once
// and are saved behind you, a toast says what happened and offers Undo (which puts the old value back; Z does the
// same), and the row you acted on holds still so the next row never slides under a second click.

import type { Command } from '../api/taska'
import { closed } from '../model/items'
import { codeOf, type ItemPatch, type ProjectModel } from '../model/project'
import type { Item } from '../model/types'
import { DID, LETTER, plural } from '../model/words'
import type { UiStore } from '../stores/ui'
import type { ChangeRunner } from './changeRunner'
import { newId } from './changeRunner'
import type { Toasts } from './toasts'

const DECISIONS: Record<string, string[]> = { proposed: ['open', 'dropped'], review: ['done', 'doing'] }

export interface ItemActionsDeps {
  slug(): string
  model(): ProjectModel | null
  runner: ChangeRunner
  toasts: Toasts
  ui: UiStore
  /** a row began holding still */
  held(): void
  /** where the list is now (its settings and open item): held rows are for one list */
  listKey(): string
  openItem(): number | null
  desk(): boolean
  /** the height of a row as drawn now */
  rowHeight(n: number): number
  /** the server's record of your change, to put back (the change log knows it was undone) */
  undoSeq(n: number, field: string): number | null
  /** words written in the box for this item go with the decision; true when they did */
  noteWith(n: number): boolean
}

/** What a change did, in words, after the item's code. */
export function saidOf(m: ProjectModel, f: string, v: unknown, before: unknown, ref: string): string {
  if (f === 'archived') return v ? 'archived' : 'unarchived'
  if (f === 'status' && v === 'done' && before === 'review') return 'accepted'
  if (f === 'status' && v === 'open' && before === 'proposed') return 'approved'
  if (f === 'pri') return `is now ${String(v)}`
  if (f === 'type') return `is now ${LETTER[v as Item['type']]}${ref.slice(1)}, ${/^[aeiou]/.test(String(v)) ? 'an' : 'a'} ${String(v)}`
  if (f === 'parent') return v ? `is now under ${codeOf(m, v as number)}` : 'stands on its own'
  if (f === 'rank') return v == null ? 'is back in order' : 'goes next in its priority'
  return DID[String(v)]
}

/** A field's value as the server takes it: a parent goes as an item reference. */
export const wire = (f: string, v: unknown) => (f === 'parent' ? (v ? String(v) : 'none') : v)

export class ItemActions {
  private readonly d: ItemActionsDeps
  constructor(deps: ItemActionsDeps) {
    this.d = deps
  }

  change(n: number, f: string, v: unknown, opts: { said?: string; note?: string } = {}): Promise<boolean> {
    const m = this.d.model()
    const it = m?.byN.get(n) as (Item & Record<string, unknown>) | undefined
    if (!m || !it || it[f] === v) return Promise.resolve(!!it)
    const slug = this.d.slug()
    const before = it[f]
    const ref = codeOf(m, n)
    const job = { saved: false, undone: false }
    // deciding on a proposal or finished work keeps what you chose on the item
    const decWas = it.decided ?? null
    const dec: Partial<Item> =
      f === 'status' && (before === 'proposed' || before === 'review')
        ? { decided: { from: String(before), to: String(v), msg: lastAgentId(it), t: '' } }
        : f === 'status' && decWas?.from === v
          ? { decided: null }
          : f === 'status' && decWas && decWas.to === before && DECISIONS[decWas.from]?.includes(String(v))
            ? { decided: { ...decWas, to: String(v) } }
            : {}
    const words =
      opts.said ||
      (it.type === 'rule' && f === 'status' && before !== 'proposed' && ({ open: 'is active again', dropped: 'is retired' } as Record<string, string>)[String(v)]) ||
      saidOf(m, f, v, before, ref)
    const undo = this.d.toasts.undoable(`${ref} ${words}`, async () => {
      const now = this.d.model()?.byN.get(n) as (Item & Record<string, unknown>) | undefined
      if (job.saved && now && JSON.stringify(now[f]) !== JSON.stringify(v)) {
        this.d.toasts.show(`${ref} changed since: nothing put back`)
        return false
      }
      job.undone = true
      this.d.ui.getState().dropHeld(n)
      this.d.toasts.show(`${ref} put back`)
      const seq = this.d.undoSeq(n, f)
      const back: Command = seq ? { op: 'revert', seq } : { op: 'set', ref, f: { [f]: wire(f, before) } }
      return this.d.runner.send(
        { id: newId(), slug, commands: [back], patches: [{ n, f: { [f]: before, ...('decided' in dec ? { decided: decWas } : {}) } as Partial<Item> }], said: `putting ${ref} back`, t: Date.now() },
        () => job.saved, // a change that never reached the server has nothing to put back there
      )
    })
    if (n !== this.d.openItem() || this.d.desk()) {
      this.d.ui.getState().hold(n, { said: words.replace(/^./, (c) => c.toUpperCase()), f, v, height: this.d.rowHeight(n) }, this.d.listKey())
      this.d.held()
    }
    const left = f === 'status' && v === 'done' ? (m.kids.get(n) || []).filter((k) => !closed(k.status)).length : 0
    const noted = f === 'status' && this.d.noteWith(n)
    this.d.toasts.show(
      `${ref} ${words}${noted ? ', with your note' : ''}${left ? ` · ${plural(left, 'subitem')} still open` : ''}${opts.note && !noted ? `. ${opts.note}.` : ''}`,
      undo,
    )
    const patch: ItemPatch = { n, f: { [f]: v, ...dec } as Partial<Item> }
    const saved = this.d.runner.send({ id: newId(), slug, commands: [{ op: 'set', ref, f: { [f]: wire(f, v) } }], patches: [patch], said: `${ref} ${words}`, t: Date.now() })
    void saved.then((ok) => {
      job.saved = ok
      if (!ok) {
        this.d.toasts.forget(undo)
        this.d.ui.getState().dropHeld(n)
      }
    })
    return saved
  }

  /** With its subitems, to Deleted; Undo (or Restore in Deleted) brings them back. Gone at once. */
  remove(n: number): Promise<boolean> {
    const m = this.d.model()
    if (!m || !m.byN.has(n)) return Promise.resolve(false)
    const slug = this.d.slug()
    const ref = codeOf(m, n)
    const tree: number[] = []
    for (let k = [n]; k.length; k = k.flatMap((x) => (m.kids.get(x) || []).map((it) => it.n))) tree.push(...k)
    const saved = this.d.runner.send({ id: newId(), slug, commands: [{ op: 'idel', ref }], patches: tree.map((k) => ({ n: k, f: {}, gone: true })), said: `deleting ${ref}`, t: Date.now() })
    const undo = this.d.toasts.undoable(`${ref} deleted`, async () => {
      const ok = await this.d.runner.send({ id: newId(), slug, commands: [{ op: 'iundel', ref }], patches: [], said: `restoring ${ref}`, t: Date.now() })
      if (ok) this.d.toasts.show(`${ref} is back`)
      return ok
    })
    this.d.toasts.show(`Deleted ${ref}`, undo)
    return saved
  }

  /** First of its priority in the agents' queue, or back where it was. */
  doNext(n: number): Promise<boolean> {
    const it = this.d.model()?.byN.get(n)
    if (!it) return Promise.resolve(false)
    return this.change(n, 'rank', it.rank == null ? -Math.round(Date.now() / 1000) : null)
  }
}

const lastAgentId = (it: Item) => [...it.thread].reverse().find((m) => !(m.by === 'you' || (m.by === 'org' && ['say', 'decide', 'propose'].includes(m.kind) && !!m.src)))?.id ?? null
