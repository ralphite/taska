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

/** A long document: enough headings for its contents. */
export const LONG = doc({
  d: 13,
  title: 'How the page is built',
  blocks: [
    { key: 'title', kind: 'heading', text: '# How the page is built', comments: [] },
    ...['Pages', 'Features', 'Stores', 'Services', 'Checks'].flatMap((h, i) => [
      { key: `h${i}`, kind: 'heading' as const, text: `## ${h}`, comments: [] },
      { key: `p${i}`, kind: 'para' as const, text: `${h}: what each one does, what it reads, and what it may not import. Each rule has a check that fails when it is broken.`, comments: [] },
      { key: `s${i}`, kind: 'heading' as const, text: `### ${h}: an example`, comments: [] },
      { key: `e${i}`, kind: 'para' as const, text: 'One file, its stories next to it, and the data it is drawn with.', comments: [] },
    ]),
  ],
  detached: [],
  whole: [],
  resolved: {},
})

/** A document with choices to tick: several formats, and one week. */
export const CHOICES = doc({
  d: 14,
  title: 'Export formats',
  blocks: [
    { key: 'title', kind: 'heading', text: '# Export formats', comments: [] },
    { key: 'p1', kind: 'para', text: 'Which formats should the export offer?', comments: [] },
    { key: 'l1', kind: 'list', text: '- [ ] CSV\n- [ ] Excel\n- [ ] JSON', comments: [] },
    { key: 'p2', kind: 'para', text: 'When should it ship?', comments: [] },
    { key: 'l2', kind: 'list', text: '- ( ) This week\n- ( ) Next week', comments: [] },
  ],
  detached: [],
  whole: [],
  resolved: {},
})
/** Its choices sent: CSV and JSON, this week. */
export const CHOICES_SENT = doc({
  ...CHOICES,
  blocks: CHOICES.blocks.map((b) => (b.key === 'l1' ? { ...b, text: '- [x] CSV\n- [ ] Excel\n- [x] JSON' } : b.key === 'l2' ? { ...b, text: '- (x) This week\n- ( ) Next week' } : b)),
})

const part = (id: string) => `h:[id='${id}']`
/** A web page an agent wrote, with comments on its parts (one on a part the page no longer has). */
export const WEB = doc({
  d: 15,
  fmt: 'html',
  title: 'Export plan',
  md: `<!doctype html><html><body style="font-family:system-ui;margin:24px;color:#18181b">
<h1 id="top">Export plan</h1><p id="intro">Three ways to ship filtered export, what each costs, and what we recommend.</p>
<div id="a" style="padding:12px;border:1px solid #e4e4e7;border-radius:12px;margin:12px 0">A: export the list as shown</div>
<div id="b" style="padding:12px;border:1px solid #e4e4e7;border-radius:12px;margin:12px 0">B: export with the filters as columns</div>
<div id="c" style="padding:12px;border:1px solid #e4e4e7;border-radius:12px">C: a link that opens the same view</div></body></html>`,
  blocks: [
    { key: part('a'), kind: 'html', text: 'A: export the list as shown', comments: [comment({ id: 21, key: part('a'), th: 21, quote: 'A: export the list as shown', text: 'This one first?', by: 'you', t: at(40) }), comment({ id: 22, key: part('a'), th: 21, quote: 'A: export the list as shown', text: 'Yes: it is the smallest.', t: at(20) })] },
    { key: part('c'), kind: 'html', text: 'C: a link that opens the same view', comments: [comment({ id: 23, key: part('c'), th: 23, quote: 'C: a link that opens the same view', text: 'Later.', by: 'you', t: at(30) })] },
    { key: part('old'), kind: 'html', text: 'D: email it every week', comments: [comment({ id: 24, key: part('old'), th: 24, quote: 'D: email it every week', text: 'Not needed.', by: 'you', t: at(90) })] },
  ],
  detached: [],
  whole: [],
  resolved: {},
})
export const WEB_PART = { a: part('a'), b: part('b'), c: part('c'), old: part('old') }
