// The project's rules as one document with versions (I693, r1116/r1118/r1128): which document it is, its versions,
// the proposals waiting on you, a version's changes as marked chunks (added, removed, one column), the history by day,
// and the rules' own addresses (/rules, /rules/history, /rules/v5, /rules/v5/now, /rules/p12). Pure.

import type { ProjectModel } from './project'
import type { Doc, RuleProposal, RuleVersion } from './types'
import { dayLabel, timeOf } from './time'
import { whoName } from './words'

export const rulesDoc = (m: ProjectModel | null | undefined): Doc | undefined => m?.docs.find((d) => d.kind === 'rules')

/** Newest first, as the history lists them. */
export const versionsOf = (d: Doc | undefined): RuleVersion[] => [...(d?.history ?? [])].reverse()

export const nowVersion = (d: Doc | undefined): RuleVersion | undefined => d?.history?.at(-1)

/** Proposals waiting on you, oldest first. */
export const waitingProposals = (d: Doc | undefined): RuleProposal[] => (d?.proposals ?? []).filter((p) => p.state === 'wait')

/** What the Rules screen shows: the document, the history, one version (against the one before, or against now), or
 * a proposal. */
export type RulesView = { kind: 'read' } | { kind: 'history' } | { kind: 'version'; v: number; now: boolean } | { kind: 'proposal'; p: number }

export function readRulesView(seg: string): RulesView {
  if (seg === 'history') return { kind: 'history' }
  const v = /^v(\d+)(\/now)?$/.exec(seg)
  if (v) return { kind: 'version', v: Number(v[1]), now: !!v[2] }
  const p = /^p(\d+)$/.exec(seg)
  if (p) return { kind: 'proposal', p: Number(p[1]) }
  return { kind: 'read' }
}

export function rulesSeg(v: RulesView): string {
  switch (v.kind) {
    case 'read':
      return ''
    case 'history':
      return 'history'
    case 'version':
      return `v${v.v}${v.now ? '/now' : ''}`
    case 'proposal':
      return `p${v.p}`
  }
}

// ----------------------------------------------------------------------------- what changed

export type Mark = '' | 'added' | 'removed'
export interface Chunk {
  mark: Mark
  text: string
}

const lines = (md: string) => md.split('\n').filter((l) => l.trim())

/** The lines of `after` against `before` (their longest common lines kept), grouped into runs of one kind, each run
 * Markdown to draw (a heading a run of its own). */
export function diffChunks(before: string, after: string): Chunk[] {
  const a = lines(before)
  const b = lines(after)
  const k = a.map(() => b.map(() => 0))
  const len = (i: number, j: number) => (i < a.length && j < b.length ? k[i][j] : 0)
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) k[i][j] = a[i] === b[j] ? len(i + 1, j + 1) + 1 : Math.max(len(i + 1, j), len(i, j + 1))
  const out: [Mark, string][] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(['', a[i]])
      i++
      j++
    } else if (i < a.length && (j >= b.length || len(i + 1, j) >= len(i, j + 1))) out.push(['removed', a[i++]])
    else out.push(['added', b[j++]])
  }
  const chunks: Chunk[] = []
  for (const [mark, line] of out) {
    const last = chunks.at(-1)
    const heading = /^#/.test(line)
    if (last && last.mark === mark && !heading && !/^#/.test(last.text.split('\n').at(-1) ?? '')) last.text += '\n' + line
    else chunks.push({ mark, text: line })
  }
  return chunks
}

/** What a version or a proposal shows of a long text: its changes, each with the run of text just before and after
 * it, the unchanged runs between folded into one line that opens them ("12 unchanged lines"). Nothing changed, or a
 * whole new text: all of it. */
export type Shown = { kind: 'chunk'; c: Chunk } | { kind: 'fold'; lines: number; chunks: Chunk[] }

export function foldRuns(chunks: readonly Chunk[]): Shown[] {
  if (!chunks.some((c) => c.mark) || chunks.every((c) => c.mark)) return chunks.map((c) => ({ kind: 'chunk', c }))
  const out: Shown[] = []
  let i = 0
  while (i < chunks.length) {
    if (chunks[i].mark) {
      out.push({ kind: 'chunk', c: chunks[i++] })
      continue
    }
    let j = i
    while (j < chunks.length && !chunks[j].mark) j++
    const run = chunks.slice(i, j)
    const head = i > 0 ? 1 : 0 // the text just after a change
    const tail = j < chunks.length ? 1 : 0 // and just before the next
    const hidden = run.slice(head, run.length - tail)
    if (hidden.length < 2) run.forEach((c) => out.push({ kind: 'chunk', c }))
    else {
      run.slice(0, head).forEach((c) => out.push({ kind: 'chunk', c }))
      out.push({ kind: 'fold', lines: hidden.reduce((s, c) => s + c.text.split('\n').length, 0), chunks: hidden })
      run.slice(run.length - tail).forEach((c) => out.push({ kind: 'chunk', c }))
    }
    i = j
  }
  return out
}

/** Lines added and removed from `before` to `after`. */
export function lineCounts(before: string, after: string): { add: number; del: number } {
  const c = diffChunks(before, after)
  const n = (m: Mark) => c.filter((x) => x.mark === m).reduce((s, x) => s + x.text.split('\n').length, 0)
  return { add: n('added'), del: n('removed') }
}

// ----------------------------------------------------------------------------- the history, by day

/** Who wrote a version or proposed a change, as the rules' pages say it. */
export const ruleWho = (by: string) => (by === 'you' ? 'You' : by === 'taska' ? 'Taska' : whoName(by))

export interface VersionRow {
  v: number
  by: string
  who: string
  day: string
  time: string
  whys: string[]
  add: number
  del: number
  /** the version the document is at */
  now: boolean
}

/** The history's rows, newest first: who, the day and time of its last save, every why, lines added and removed. */
export function historyRows(d: Doc | undefined, now: number): VersionRow[] {
  const h = d?.history ?? []
  return h
    .map((x, i) => {
      const c = lineCounts(i > 0 ? h[i - 1].md : '', x.md)
      return { v: x.v, by: x.by, who: ruleWho(x.by), day: dayLabel(x.t, now), time: timeOf(x.t), whys: x.whys, add: c.add, del: c.del, now: i === h.length - 1 }
    })
    .reverse()
}

/** The document a place shows: a document's own address, or the rules on the Rules tab (read, or one of their pages:
 * a comment on a proposal goes to the rules document too). */
export function placeDoc(r: { tab: string; place: { kind: string; d?: number } }, m: ProjectModel | null | undefined): number | null {
  if (r.place.kind === 'doc' && r.place.d != null) return r.place.d
  if (r.tab === 'rules' && (r.place.kind === 'tab' || r.place.kind === 'rules')) return rulesDoc(m)?.d ?? null
  return null
}

/** How the box names the document a comment goes to: D4, or the rules (whose number is nobody's business). */
export const docName = (d: Doc) => (d.kind === 'rules' ? 'the rules' : `D${d.d}`)

/** What needs you in a project: the items waiting on you and the proposed changes to the rules (I693). */
export const needsCount = (m: ProjectModel, needsYou: (it: ProjectModel['items'][number]) => boolean) => m.items.filter(needsYou).length + waitingProposals(rulesDoc(m)).length

/** The text a version changed from: the one before it ('' for the first). */
export function beforeOf(d: Doc | undefined, v: number): string {
  const h = d?.history ?? []
  const i = h.findIndex((x) => x.v === v)
  return i > 0 ? h[i - 1].md : ''
}
