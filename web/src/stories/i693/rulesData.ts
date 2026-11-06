// I693 prototype: a project's rules as one Markdown document with versions. The demo document's versions (who, when,
// why, the text), an agent's proposal on the current one, and the line diff the history and the proposal show.
// Prototype only: nothing of the page uses it.

import { T } from '../fixtures'

export interface Version {
  v: number
  by: string
  /** minutes before the stories' "now" */
  ago: number
  why: string
  md: string
  /** a restore: the version it put back */
  restored?: number
}

export interface Proposal {
  by: string
  ago: number
  why: string
  /** the version it was written on */
  on: number
  md: string
  decided?: 'Approve' | 'Not now'
}

const COMMUNICATION = ['## Communication', '', '- Write to Yadong in Taska only; one line, a document for more.', '- Ask before work that changes the scope.']
const AGENTS = (lines: string[]) => ['## How agents work', '', ...lines]
const COMMITS = (lines: string[]) => ['## Commits', '', ...lines]
const doc = (...parts: string[][]) => ['# Project rules', ...parts.flatMap((p) => ['', ...p])].join('\n')

const SMALL = '- Small changes: the main agent makes them; big ones go to their own worktree.'
const BIG = '- Big changes go to their own worktree.'
const DEPS = '- Never add a dependency without asking.'
const READ = '- Read this document once per session.'
const ENGLISH = '- Commit messages are in English.'
const IMPERATIVE = '- Commit messages are in English, in the imperative ("Add", "Fix").'
const PATHS = '- One step per commit; add only the paths you changed.'

const V1 = doc(['## Communication', '', '- Write to Yadong in Taska only.', '- Ask before work that changes the scope.'], COMMITS([ENGLISH]))
const V3 = doc(COMMUNICATION, COMMITS([ENGLISH]))
const V4 = doc(COMMUNICATION, COMMITS([ENGLISH, PATHS]))
const V5 = doc(COMMUNICATION, AGENTS([BIG]), COMMITS([ENGLISH, PATHS]))
const V6 = doc(COMMUNICATION, AGENTS([BIG, DEPS]), COMMITS([ENGLISH, PATHS]))
const V7 = doc(COMMUNICATION, AGENTS([READ, SMALL, DEPS]), COMMITS([ENGLISH, PATHS]))
const V8 = doc(COMMUNICATION, AGENTS([READ, SMALL, DEPS]), COMMITS([IMPERATIVE, PATHS]))

/** Newest first, as the history lists them. */
export const VERSIONS: Version[] = [
  { v: 8, by: 'you', ago: 120, why: 'Commits in the imperative', md: V8 },
  { v: 7, by: 'claude-code', ago: 280, why: 'Read the rules once per session', md: V7 },
  { v: 6, by: 'you', ago: 60 * 21, why: 'No new dependencies', md: V6 },
  { v: 5, by: 'codex', ago: 60 * 29, why: 'Big changes in a worktree', md: V5 },
  { v: 4, by: 'org', ago: 60 * 50, why: 'One step per commit', md: V4 },
  { v: 3, by: 'you', ago: 60 * 53, why: '', md: V3 },
  { v: 2, by: 'you', ago: 60 * 54, why: 'Shorter messages', md: V3.replace('one line, a document for more', 'keep it short') },
  { v: 1, by: 'taska', ago: 60 * 75, why: 'Rules moved into one document', md: V1 },
]

/** After restoring v5: v9 is v5's text again. */
export const RESTORED: Version[] = [{ v: 9, by: 'you', ago: 0, why: 'Restored v5', md: V5, restored: 5 }, ...VERSIONS]

const TESTS = '- Run the unit tests before each commit.'
export const PROPOSAL: Proposal = { by: 'claude-code', ago: 10, why: 'Run the unit tests before each commit', on: 8, md: doc(COMMUNICATION, AGENTS([READ, SMALL, DEPS]), COMMITS([IMPERATIVE, TESTS, PATHS])) }

/** a time "ago" minutes before the stories' now */
export const at = (ago: number) => new Date(Date.parse(T) - ago * 60_000).toISOString()

// ----------------------------------------------------------------------------- the diff

export type Mark = '' | 'added' | 'removed'
export interface Chunk {
  mark: Mark
  text: string
}

/** The lines of `after` against `before` (their longest common lines kept), grouped into runs of one kind, each run
 * as Markdown (a blank line kept after a heading so it reads as one). */
export function diff(before: string, after: string): Chunk[] {
  const a = before.split('\n').filter((l) => l.trim())
  const b = after.split('\n').filter((l) => l.trim())
  const k = a.map(() => b.map(() => 0))
  const len = (i: number, j: number) => (i < a.length && j < b.length ? k[i][j] : 0)
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) k[i][j] = a[i] === b[j] ? len(i + 1, j + 1) + 1 : Math.max(len(i + 1, j), len(i, j + 1))
  const lines: [Mark, string][] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(['', a[i]])
      i++
      j++
    } else if (i < a.length && (j >= b.length || len(i + 1, j) >= len(i, j + 1))) lines.push(['removed', a[i++]])
    else lines.push(['added', b[j++]])
  }
  const out: Chunk[] = []
  for (const [mark, line] of lines) {
    const last = out.at(-1)
    const heading = /^#/.test(line)
    if (last && last.mark === mark && !heading && !/^#/.test(last.text.split('\n').at(-1) ?? '')) last.text += '\n' + line
    else out.push({ mark, text: line })
  }
  return out
}

/** Lines added and removed from `before` to `after`. */
export function counts(before: string, after: string): { add: number; del: number } {
  const c = diff(before, after)
  const n = (m: Mark) => c.filter((x) => x.mark === m).reduce((s, x) => s + x.text.split('\n').length, 0)
  return { add: n('added'), del: n('removed') }
}
