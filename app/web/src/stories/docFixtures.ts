// A document for stories: a title, words, a heading, a list, a quote, code and a table; comment threads (one
// resolved, one quoting words in a paragraph, one on the whole document) and comments whose words changed.

import type { Comment, Doc } from '../model/types'
import { T } from './fixtures'

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()

export const comment = (f: Partial<Comment> & { id: number; key: string }): Comment => ({ th: 0, quote: '', text: 'Looks right to me.', by: 'claude-code', t: at(30), files: [], ...f })

export function doc(f: Partial<Doc> = {}): Doc {
  const blocks: Doc['blocks'] = [
    { key: 'title', kind: 'heading', text: '# The rewrite plan', comments: [] },
    { key: 'p1', kind: 'para', text: 'The new page is written from scratch, and the old one stays in use until the ports are swapped.', comments: [comment({ id: 1, key: 'p1', th: 1, quote: 'stays in use', text: 'Until when exactly?', by: 'you', t: at(50) }), comment({ id: 2, key: 'p1', th: 1, quote: 'stays in use', text: 'Until every check is green.', t: at(10) })] },
    { key: 'h1', kind: 'heading', text: '## Steps', comments: [] },
    { key: 'l1', kind: 'list', text: '- Write the goals\n- Build the pilot\n  - one item page\n- Swap the ports', comments: [comment({ id: 3, key: 'l1', th: 3, quote: 'Build the pilot', text: 'Pilot first, yes.', by: 'you' })] },
    { key: 'q1', kind: 'quote', text: '> Nothing the user relies on is frozen.', comments: [] },
    { key: 'c1', kind: 'code', text: '```\nnpm run check\n```', comments: [] },
    { key: 't1', kind: 'table', text: '| Step | Who |\n| --- | --- |\n| Goals | Coordinator |\n| Code | Implementer |', comments: [comment({ id: 4, key: 't1', th: 4, text: 'Done.', by: 'you' })] },
  ]
  return {
    d: 12,
    n: 12,
    title: 'The rewrite plan',
    md: blocks.map((b) => b.text).join('\n\n'),
    t0: at(600),
    t1: at(45),
    by: 'claude-code',
    versions: 2,
    fmt: 'md',
    blocks,
    detached: [{ key: 'old', quote: 'The old page is ported as it is.', comments: [comment({ id: 5, key: 'old', th: 5, text: 'No: a new design.', by: 'you' })] }],
    whole: [comment({ id: 6, key: 'doc', th: 6, text: 'Good plan overall.' })],
    unanswered: 0,
    resolved: { 't1#4': at(5) },
    ...f,
  }
}
