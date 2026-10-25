// An item's row in the list, one story for each state it can be in (T591: the groups and names Yadong had before the
// rewrite). Each is the page's own ItemRow with that state's data, on the phone and the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frames, States } from '../../stories/Frames'
import { PICTURE, facts, item, look, message, noRowEvents } from '../../stories/fixtures'
import { ItemRow, type RowFacts, type RowLook } from './ListRows'

export default { title: 'Components/Item list/Item row' } satisfies Meta
type Story = StoryObj

interface Row {
  it?: Partial<Item>
  f?: Partial<RowFacts>
  l?: Partial<RowLook>
  depth?: number
  foldable?: boolean
  folded?: boolean
}

const row = (r: Row, desk: boolean) => (
  <ItemRow
    it={item({ n: 12, ...r.it })}
    depth={r.depth ?? 0}
    band=""
    foldable={r.foldable ?? false}
    folded={r.folded ?? false}
    facts={facts(r.f)}
    look={look(desk, r.l)}
    on={noRowEvents}
  />
)
const one = (r: Row): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={460}>{(layout) => row(r, layout === 'desk')}</Frames> })

const agent = { by: 'claude-code', t: '2026-10-23T14:30:00-07:00' }

/** Open in the pane, picked, dragged and where a dragged row would go, together. (Under the pointer is not drawn:
 * only a pointer shows it.) */
export const Together: Story = {
  name: 'Pointer, keys, picked, dragged: all side by side',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['open in the pane (where the keys are)', row({ l: { current: true } }, desk)],
              ['picked', row({ l: { selected: true } }, desk)],
              ['dragged', row({ l: { drag: 'dragging' } }, desk)],
              ['a dragged row would go before it', row({ l: { drag: 'before' } }, desk)],
              ['after it', row({ l: { drag: 'after' } }, desk)],
              ['under it', row({ l: { drag: 'into' } }, desk)],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

export const Open = one({})
export const NextInTheQueue = one({ f: { next: true } })
export const InProgress = one({ it: { status: 'doing', agent }, f: { worker: { by: 'claude-code', tip: 'Claude Code is on it', quiet: false }, talk: 4 } })
export const InProgressAgentQuiet: Story = { ...one({ it: { status: 'doing' }, f: { worker: { by: 'codex', tip: 'Codex · quiet 2h', quiet: true } } }), name: 'In progress, agent quiet' }
export const WaitsForReview = one({ it: { status: 'review' } })
export const YourAgentsTurn: Story = { ...one({ it: { talked: true, thread: [message({ id: 3, by: 'you', kind: 'say' })] }, f: { talk: 1 } }), name: 'Your agent’s turn (you replied)' }
export const Done = one({ it: { status: 'done' } })
export const WontDo: Story = { ...one({ it: { status: 'dropped' } }), name: 'Won’t do' }
export const Archived = one({ it: { status: 'done', archived: true } })
export const Subitem = one({ depth: 1, it: { n: 14, parent: 3, title: 'Keep the filter in the export file name' }, f: { code: 'F014' } })
export const PartOfAnother: Story = { ...one({ it: { n: 14, parent: 3 }, f: { code: 'F014', parentCode: 'F003' } }), name: 'Part of another item (not under it here)' }
export const WithSubitems = one({ foldable: true, f: { kids: { done: 3, all: 8 } } })
export const WithSubitemsFolded: Story = { ...one({ foldable: true, folded: true, f: { kids: { done: 3, all: 8 } } }), name: 'With subitems, folded' }
export const Later = one({ it: { when: 'later', pri: 'P3' } })
export const Rule = one({ it: { type: 'rule', title: 'Commit messages are in English' }, f: { code: 'R012' } })
export const WithAPicture = one({ f: { image: { f: 'f1-shot.png', src: PICTURE } } })
export const WithADraft = one({ f: { draft: true } })
export const NewFromAnAgent = one({ f: { unread: true, talk: 2 } })
export const OpenInThePane = one({ l: { current: true } })
export const Picked = one({ l: { selected: true } })
export const SearchedWords: Story = { ...one({ l: { words: ['filter', 'csv'] }, f: { hitLine: '…the CSV keeps every row' } }), name: 'Searched words marked, one found in its talk' }
export const P0 = one({ it: { type: 'bug', pri: 'P0', title: 'Saving drops the last word' }, f: { code: 'B012' } })
export const P3 = one({ it: { pri: 'P3' } })
export const LongChineseTitle = one({ it: { title: '\u81ea\u884c\u5168\u9762\u6d4b\u8bd5\u5e76\u4fee\u590d\u7f51\u9875\u6587\u6863\u7684\u6240\u6709 bug\uff0c\u5305\u62ec\u8bc4\u8bba\u3001\u9009\u533a\u3001\u622a\u56fe\u548c\u5bfc\u51fa\uff0c\u5728\u624b\u673a\u548c\u7535\u8111\u4e0a\u90fd\u8981\u6d4b' } })
export const LongEnglishTitle = one({ it: { title: 'Search finds the words in an item’s talk and its documents too, and says where it found them when that is not the title' } })
