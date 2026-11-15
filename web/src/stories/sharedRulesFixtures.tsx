// Shared rules (I779) as the page has them: three shared rules (通用, 编程, 写作) with their sections as the server
// lists them, the projects that put them in, and Taska's rules that start with {{通用}} and {{编程}}; what an agent
// reads for them is the server's own text (sharedRules.json, held to the server's code by tests/test_shared_rules.py).
// The stories of the Rules tab's shared rules and of Settings › Shared rules draw these.

import { useState } from 'react'
import { includeRuns } from '../features/docs/Include'
import type { Doc, RuleVersion, SharedRule } from '../model/types'
import { comment, doc } from './docFixtures'
import { at } from './rulesFixtures'
import { acts } from './acts'
import data from './sharedRules.json'
import type { InlineWorld } from '../ui/markdown/inline'

const USED: Record<string, { project: string; title: string; line: string }[]> = {
  通用: [
    { project: 'taska', title: 'Taska', line: '{{通用}}' },
    { project: 'system-design', title: 'System design', line: '{{通用}}' },
    { project: 'shop', title: 'Shop', line: '{{通用}}' },
    { project: 'home', title: 'Home', line: '{{通用}}' },
  ],
  编程: [
    { project: 'taska', title: 'Taska', line: '{{编程}}' },
    { project: 'shop', title: 'Shop', line: '{{编程}}' },
    { project: 'home', title: 'Home', line: '{{编程 › 测试}}' },
  ],
  写作: [{ project: 'system-design', title: 'System design', line: '{{写作}}' }],
}
const WHEN: Record<string, { v: number; by: string; ago: number }> = { 通用: { v: 4, by: 'you', ago: 60 * 26 }, 编程: { v: 3, by: 'claude-code', ago: 140 }, 写作: { v: 1, by: 'you', ago: 60 * 24 * 6 } }
const SLUG: Record<string, string> = { 通用: '~k3m7p', 编程: '~q8rt2', 写作: '~w4hn9' }

export const SHARED_RULES: SharedRule[] = data.shared.map((s) => ({ ...s, slug: SLUG[s.name], v: WHEN[s.name].v, by: WHEN[s.name].by, t: at(WHEN[s.name].ago), used: USED[s.name] }))
export const sharedOf = (name: string) => SHARED_RULES.find((s) => s.name === name) as SharedRule

/** Taska's rules as written: {{通用}}, {{编程}}, then its own. */
export const TASKA_RULES = data.rules
/** the same with a name written wrong */
export const TASKA_BROKEN = TASKA_RULES.replace('{{编程}}', '{{编程X}}')
/** what an agent reads for Taska's rules: the server's text */
export const AGENT_TEXT = data.agent

const blocksOf = (md: string): Doc['blocks'] => md.split(/\n{2,}/).map((t, i) => ({ key: 'b' + i, kind: /^#/.test(t) ? 'heading' : /^- /.test(t) ? 'list' : 'para', text: t, comments: [] }))

/** A rules document as the page has it: its text, its blocks, one version. */
export function rulesWith(md: string, v: number, by: string, ago: number, d = 5): Doc {
  const x: RuleVersion = { v, by, t0: at(ago + 4), t: at(ago), md, whys: [], srcs: [], seq: v * 10 }
  return doc({ d, n: 0, title: 'Rules', md, blocks: blocksOf(md), detached: [], whole: [], resolved: {}, t1: x.t, by, kind: 'rules', history: [x], proposals: [] })
}

/** Taska's rules document (v6, yours, 12 minutes ago). */
export const taskaRules = (md = TASKA_RULES) => rulesWith(md, 6, 'you', 12)

/** A shared rule's own document (its page is the Rules tab's); 编程's line on heavy tests has a thread. */
export function sharedDoc(s: SharedRule): Doc {
  const w = WHEN[s.name]
  const d = rulesWith(s.md, w.v, w.by, w.ago, 1)
  const b = d.blocks.find((x) => x.text.includes('重测试'))
  if (b)
    b.comments = [
      comment({ id: 11, key: b.key, th: 11, quote: '一天最多一次', text: '整组 e2e 也算在里面吗？', by: 'you', t: at(130) }),
      comment({ id: 12, key: b.key, th: 11, quote: '一天最多一次', text: '算，e2e 就是重测试。', t: at(125) }),
    ]
  return d
}

const includeActs = acts('Shared rules', ['open'] as const, { open: 'UI › Rules tab › Shared rules › A shared rule’s page' })

/** The Rules tab's paragraphs with lines, drawn as the page draws them (a click on a block opens or closes it). */
export function useLines(world: InlineWorld, start: string[] = [], shared: SharedRule[] | null = SHARED_RULES) {
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set(start))
  const toggle = (label: string) => {
    const next = new Set(opened)
    if (!next.delete(label)) next.add(label)
    setOpened(next)
  }
  return (text: string) => includeRuns(text, shared, world, opened, { toggle, open: includeActs.open })
}
