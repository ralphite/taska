import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { PICTURE, facts, item, look, message, noRowEvents } from '../../stories/fixtures'
import { ArchiveAllLine, HeldRow, HiddenKidsLine, ItemRow, NeedsMoreLine, NeedsRow, Zone } from './ListRows'

const meta: Meta = { title: 'Components/List/Rows' }
export default meta
type Story = StoryObj

const on = noRowEvents
const row = (desk: boolean, extra: Partial<Parameters<typeof ItemRow>[0]> = {}) => (
  <ItemRow it={item({ n: 12 })} depth={0} band="" foldable={false} folded={false} facts={facts()} look={look(desk)} on={on} {...extra} />
)

/** An item's row in each of the states it can be in. */
export const ItemRows: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['open', row(desk)],
              ['next in the queue', row(desk, { facts: facts({ next: true }) })],
              ['in progress, an agent on it', row(desk, { it: item({ n: 12, status: 'doing', agent: { by: 'claude-code', t: '2026-10-23T14:30:00-07:00' } }), facts: facts({ worker: { by: 'claude-code', tip: 'Claude Code is on it', quiet: false }, talk: 4 }) })],
              ['in progress, the agent gone quiet', row(desk, { it: item({ n: 12, status: 'doing' }), facts: facts({ worker: { by: 'codex', tip: 'Codex · quiet 2h', quiet: true } }) })],
              ['your agent’s turn (you replied)', row(desk, { it: item({ n: 12, talked: true, thread: [message({ id: 3, by: 'you', kind: 'say' })] }), facts: facts({ talk: 1 }) })],
              ['later', row(desk, { it: item({ n: 12, when: 'later', pri: 'P3' }) })],
              ['P0, a bug', row(desk, { it: item({ n: 12, type: 'bug', pri: 'P0', title: 'Saving drops the last word' }), facts: facts({ code: 'B012' }) })],
              ['done (finished, struck through)', row(desk, { it: item({ n: 12, status: 'done' }) })],
              ['won’t do', row(desk, { it: item({ n: 12, status: 'dropped' }) })],
              ['with subitems, folded open', row(desk, { foldable: true, facts: facts({ kids: { done: 3, all: 8 } }) })],
              ['with subitems, folded', row(desk, { foldable: true, folded: true, facts: facts({ kids: { done: 3, all: 8 } }) })],
              ['a subitem (depth 1), part of F003', row(desk, { depth: 1, it: item({ n: 14, parent: 3, title: 'Keep the filter in the export file name' }), facts: facts({ code: 'F014' }) })],
              ['part of F003 (not under it here)', row(desk, { it: item({ n: 14, parent: 3 }), facts: facts({ code: 'F014', parentCode: 'F003' }) })],
              ['with a picture', row(desk, { facts: facts({ image: { f: 'f1-shot.png', src: PICTURE } }) })],
              ['new from an agent (blue dot)', row(desk, { facts: facts({ unread: true, talk: 2 }) })],
              ['a draft written for it', row(desk, { facts: facts({ draft: true }) })],
              ['open in the pane', row(desk, { look: look(desk, { current: true }) })],
              ['picked (Cmd-click)', row(desk, { look: look(desk, { selected: true }) })],
              ['searched words marked, one found in the talk', row(desk, { look: look(desk, { words: ['filter', 'csv'] }), facts: facts({ hitLine: '…the CSV keeps every row' }) })],
              ['a long title', row(desk, { it: item({ n: 12, title: '自行全面测试并修复网页文档的所有 bug，包括评论、选区、截图和导出，在手机和电脑上都要测' }) })],
              ['a rule', row(desk, { it: item({ n: 12, type: 'rule', title: 'Commit messages are in English' }), facts: facts({ code: 'R012' }) })],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

/** A row that waits on you: its one action on the right. */
export const NeedsRows: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {(layout) => {
        const desk = layout === 'desk'
        const needs = (it: ReturnType<typeof item>, excerpt: string, f = facts()) => <NeedsRow it={it} depth={0} facts={f} look={look(desk)} excerpt={excerpt} on={on} />
        return (
          <States
            items={[
              ['a question: Answer', needs(item({ n: 12, wait: { id: 4, kind: 'ask', text: 'Keep the old export?', by: 'claude-code', files: [] } }), 'Keep the old export?')],
              ['blocked: Answer', needs(item({ n: 12, status: 'doing', wait: { id: 4, kind: 'block', text: 'I need the API key for staging', by: 'codex', files: [] } }), 'I need the API key for staging')],
              ['proposed: Approve', needs(item({ n: 12, status: 'proposed', by: 'claude-code' }), '')],
              ['finished: Accept', needs(item({ n: 12, status: 'review' }), 'Done: the export keeps the filter now')],
              ['later, part of F003', needs(item({ n: 14, status: 'proposed', when: 'later', parent: 3 }), 'Split from F003', facts({ code: 'F014', parentCode: 'F003' }))],
              ['a rule an agent proposed', needs(item({ n: 15, type: 'rule', status: 'proposed', title: 'Screenshots go in the item' }), '', facts({ code: 'R015' }))],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

/** The quiet line a row becomes while the list holds still, and the list's other lines. */
export const Lines: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['held: approved', <HeldRow it={item({ n: 12, status: 'open' })} code="F012" said="Approved" height={64} on={on} />],
            ['held: marked won’t do', <HeldRow it={item({ n: 12, status: 'dropped' })} code="F012" said="Is marked won't do" height={64} on={on} />],
            ['zone: needs you', <Zone kind="needs" label="Needs you" n={3} />],
            ['zone: rules', <Zone kind="rules" label="Active" n={12} />],
            ['zone: retired', <Zone kind="retired" label="Retired" n={2} />],
            ['zone: later', <Zone kind="later" label="Later" n={5} />],
            ['hidden subitems: finished', <HiddenKidsLine parent={1} depth={1} open={false} later={0} done={8} onToggle={() => {}} />],
            ['hidden subitems: later and finished', <HiddenKidsLine parent={1} depth={1} open={false} later={2} done={3} onToggle={() => {}} />],
            ['hidden subitems: shown', <HiddenKidsLine parent={1} depth={1} open later={2} done={3} onToggle={() => {}} />],
            ['needs you: show more', <NeedsMoreLine open={false} rest={4} onToggle={() => {}} />],
            ['needs you: show fewer', <NeedsMoreLine open rest={4} onToggle={() => {}} />],
            ['finished: archive them', <ArchiveAllLine n={7} onArchive={() => {}} />],
          ]}
        />
      )}
    </Frames>
  ),
}
