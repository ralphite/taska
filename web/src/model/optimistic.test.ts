// What a change shows at once is what the server makes of it (refactor 7): each case ran on the real server
// (tools/rule_cases.py: the project before, the commands, the project after); the preview of the same commands over
// the same project must show the same items, inputs and documents.

import { describe, expect, it as test } from 'vitest'
import { projectFacts } from '../stories/fixtures'
import { preview } from './optimistic'
import { merge, project, STAND, type ProjectModel } from './project'
import { EFFECTS, type Seen } from './ruleCases.gen'
import type { Comment, Doc } from './types'

const modelOf = (s: Seen, at = 1): ProjectModel =>
  project(merge(null, { cursor: 'c', full: true, items: s.items, inputs: s.inputs, docs: s.docs, voices: s.voices, project: projectFacts({ undo: s.undo, width: 1 }), server: { page: '', update: false } }, at))

/** What the page draws of an item, an input, a document (not its times, not the ids a stand-in has). */
const itemSeen = (m: ProjectModel) =>
  Object.fromEntries(
    m.items.map((it) => [
      it.n >= STAND ? `new ${it.title}` : it.n,
      { type: it.type, title: it.title, body: it.body, pri: it.pri, when: it.when, status: it.status, parent: it.parent, next: it.next, archived: it.archived, mergedInto: it.mergedInto, rank: it.rank ?? null, later_until: it.later_until ?? null, decided: it.decided ? [it.decided.from, it.decided.to, it.decided.msg] : null, wait: !!it.wait, hidden: it.thread.filter((x) => x.hidden).map((x) => x.id) },
    ]),
  )
const inputSeen = (m: ProjectModel) => Object.fromEntries(m.inputs.map((r) => [r.id, { text: r.text, scope: r.scope, kind: r.kind ?? null, acked: r.acked, files: r.files.map((f) => f.f) }]))
const commentSeen = (c: Comment) => [c.key, c.quote, c.text, c.by, c.files.map((f) => f.f).join(' ')].join(' | ')
const docSeen = (m: ProjectModel) =>
  Object.fromEntries(
    m.docs.map((d: Doc) => [
      d.d,
      {
        n: d.n,
        md: d.md,
        resolved: Object.keys(d.resolved).sort(),
        comments: [...d.whole, ...d.blocks.flatMap((b) => b.comments), ...d.detached.flatMap((t) => t.comments)].map(commentSeen).sort(),
      },
    ]),
  )

describe("a change shows at once what the server makes of it (the server's own cases)", () => {
  test.each(EFFECTS.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const before = modelOf(c.before)
    const shown = preview(before, c.commands, 2)
    const copy = merge(null, { cursor: 'c', full: true, items: c.before.items, inputs: c.before.inputs, docs: c.before.docs, voices: c.before.voices, project: projectFacts({ undo: c.before.undo, width: 1 }), server: { page: '', update: false } }, 1)
    const now = project(copy, shown.patches, 2, shown.inputPatches, shown.docPatches)
    const after = modelOf(c.after)
    // a new item has its number from Taska: the stand-in is told by its title
    const fresh = new Set(c.after.items.filter((it) => !c.before.items.some((b) => b.n === it.n)).map((it) => it.n))
    const want = Object.fromEntries(Object.entries(itemSeen(after)).map(([k, v]) => [fresh.has(Number(k)) ? `new ${v.title}` : k, v]))
    expect(itemSeen(now)).toEqual(want)
    // what you said shows from the outbox (model/outgoing) until Taska has it: a new input is not a preview's
    const had = new Set(c.before.inputs.map((r) => r.id))
    expect(inputSeen(now)).toEqual(Object.fromEntries(Object.entries(inputSeen(after)).filter(([id]) => had.has(id))))
    expect(docSeen(now)).toEqual(docSeen(after))
  })
})
