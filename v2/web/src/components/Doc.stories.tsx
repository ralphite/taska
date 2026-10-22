import type { Meta, StoryObj } from '@storybook/react-vite'
import { DocView } from './Doc'
import { item, load } from '../test/fixture'
import { U } from '../lib/state'
import type { Block, Comment, Doc } from '../lib/types'

// T457: a document as you read it: plain, with comments, a paragraph picked to comment on
const t = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const c = (id: number, key: string, by: string, text: string, quote = ''): Comment => ({
  id,
  key,
  quote,
  text,
  by,
  t: t(id),
})
const blocks = (withComments: boolean): Block[] => [
  { key: 'h1', kind: 'heading', text: '# The export plan', comments: [] },
  {
    key: 'p1',
    kind: 'para',
    text: '**Conclusion**: ship option A today and option B next week.',
    comments: withComments
      ? [c(1, 'p1', 'you', 'Why not B first?'), c(2, 'p1', 'claude-code', 'A is one day; B needs the new filter.')]
      : [],
  },
  { key: 'h2', kind: 'heading', text: '## Options', comments: [] },
  {
    key: 'l1',
    kind: 'list',
    text: '- **A**: fast and simple, ships today\n- **B**: safe and slow, ships next week\n- **C**: do nothing',
    comments: withComments ? [c(3, 'l1', 'you', 'C is not an option.', 'C: do nothing')] : [],
  },
  { key: 'q1', kind: 'quote', text: '> Pick one in the item; the agent starts when you approve.', comments: [] },
  { key: 'c1', kind: 'code', text: '```\npython3 -m taska logs --since 2h\n```', comments: [] },
  { key: 't1', kind: 'table', text: '| Option | Days |\n|---|---|\n| A | 1 |\n| B | 5 |', comments: [] },
]
const doc = (withComments: boolean): Doc => {
  const b = blocks(withComments)
  return {
    d: 7,
    n: 1,
    title: 'The export plan',
    md: b.map((x) => x.text).join('\n\n'),
    t0: t(300),
    t1: t(60),
    by: 'claude-code',
    versions: 2,
    comments: b.flatMap((x) => x.comments),
    blocks: b,
    detached: [],
    whole: withComments ? [c(4, 'doc', 'you', 'Overall fine, see my notes.')] : [],
    open: withComments ? 2 : 0,
  }
}
const setup =
  (withComments: boolean, pick = false) =>
  () => {
    const d = doc(withComments)
    load([item(1, { title: 'Export plan' })], { docs: [d] })
    U.doc = 7
    U.docSel = new Set(pick ? ['p1'] : [])
    U.docQuote = null
    return { d }
  }
const meta: Meta = { title: 'Page/Document' }
export default meta
const view = (_: unknown, { loaded }: { loaded: Record<string, unknown> }) => (
  <div className="h-[860px] max-w-[46rem] overflow-y-auto">
    <DocView d={loaded.d as Doc} />
  </div>
)
export const Plain: StoryObj = { loaders: [setup(false)], render: view }
export const WithComments: StoryObj = { loaders: [setup(true)], render: view }
export const ParagraphPicked: StoryObj = { loaders: [setup(true, true)], render: view }
