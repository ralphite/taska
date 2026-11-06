// A project's rules document with versions (I693): who wrote each version, when, why, the text it left, an agent's
// proposal on the current one, and the document as the page has it. The stories of the Rules tab draw these.

import { comment, doc } from './docFixtures'
import { T } from './fixtures'
import type { Doc, RuleProposal, RuleVersion } from '../model/types'

/** a time `ago` minutes before the stories' now */
export const at = (ago: number) => new Date(Date.parse(T) - ago * 60_000).toISOString()

const COMMUNICATION = ['## Communication', '', '- Write to Yadong in Taska only; one line, a document for more.', '- Ask before work that changes the scope.']
const AGENTS = (lines: string[]) => ['## How agents work', '', ...lines]
const COMMITS = (lines: string[]) => ['## Commits', '', ...lines]
const text = (...parts: string[][]) => parts.map((p) => p.join('\n')).join('\n\n')

const SMALL = '- Small changes: the main agent makes them; big ones go to their own worktree.'
const BIG = '- Big changes go to their own worktree.'
const DEPS = '- Never add a dependency without asking.'
const READ = '- Read this document once per session.'
const ENGLISH = '- Commit messages are in English.'
const IMPERATIVE = '- Commit messages are in English, in the imperative ("Add", "Fix").'
const PATHS = '- One step per commit; add only the paths you changed.'
const TESTS = '- Run the unit tests before each commit.'

const V1 = text(['## Communication', '', '- Write to Yadong in Taska only.', '- Ask before work that changes the scope.'], COMMITS([ENGLISH]))
const V2 = text(COMMUNICATION, COMMITS([ENGLISH]))
const V3 = text(COMMUNICATION, COMMITS([ENGLISH, PATHS]))
const V4 = text(COMMUNICATION, AGENTS([BIG]), COMMITS([ENGLISH, PATHS]))
const V5 = text(COMMUNICATION, AGENTS([BIG, DEPS]), COMMITS([ENGLISH, PATHS]))
const V6 = text(COMMUNICATION, AGENTS([READ, SMALL, DEPS]), COMMITS([ENGLISH, PATHS]))
const V7 = text(COMMUNICATION, AGENTS([READ, SMALL, DEPS]), COMMITS([IMPERATIVE, PATHS]))

const ver = (v: number, by: string, ago: number, whys: string[], md: string, more: Partial<RuleVersion> = {}): RuleVersion => ({ v, by, t0: at(ago + 4), t: at(ago), md, whys, srcs: [], seq: v * 10, ...more })

/** Oldest first, as the server sends them. Yadong's two saves of v7 were minutes apart: one version, both whys. */
export const HISTORY: RuleVersion[] = [
  ver(1, 'taska', 60 * 75, ['Rules moved into one document'], V1),
  ver(2, 'you', 60 * 53, [], V2),
  ver(3, 'org', 60 * 50, ['One step per commit'], V3, { srcs: ['r812'] }),
  ver(4, 'codex', 60 * 29, ['Big changes in a worktree'], V4, { p: 40 }),
  ver(5, 'you', 60 * 21, ['No new dependencies'], V5),
  ver(6, 'claude-code', 280, ['Read the rules once per session'], V6, { p: 60 }),
  ver(7, 'you', 120, ['Commits in the imperative', 'Name the verbs'], V7),
]

/** After restoring v4: v8 is v4's text again. */
export const RESTORED: RuleVersion[] = [...HISTORY, ver(8, 'you', 0, ['Restored v4'], V4, { restored: 4 })]

export const PROPOSAL: RuleProposal = {
  id: 90,
  by: 'claude-code',
  t: at(10),
  why: 'Run the unit tests before each commit',
  state: 'wait',
  on: 7,
  md: text(COMMUNICATION, AGENTS([READ, SMALL, DEPS]), COMMITS([IMPERATIVE, TESTS, PATHS])),
  comments: [],
}

/** The rules document as the page has it: its blocks (one with a thread), its versions and its proposals. */
export function rulesDocOf(history: RuleVersion[] = HISTORY, proposals: RuleProposal[] = [PROPOSAL]): Doc {
  const now = history.at(-1) as RuleVersion
  const blocks: Doc['blocks'] = now.md.split(/\n{2,}/).map((t, i) => ({ key: 'b' + i, kind: /^#/.test(t) ? 'heading' : /^- /.test(t) ? 'list' : 'para', text: t, comments: [] }))
  const agents = blocks.findIndex((b) => b.text.includes('once per session'))
  if (agents >= 0)
    blocks[agents].comments = [
      comment({ id: 1, key: blocks[agents].key, th: 1, quote: 'once per session', text: 'Codex too?', by: 'you', t: at(100) }),
      comment({ id: 2, key: blocks[agents].key, th: 1, quote: 'once per session', text: 'Yes: every agent reads it.', t: at(95) }),
    ]
  return doc({ d: 5, n: 0, title: 'Rules', md: now.md, blocks, detached: [], whole: [], resolved: {}, t1: now.t, by: now.by, kind: 'rules', history, proposals })
}
