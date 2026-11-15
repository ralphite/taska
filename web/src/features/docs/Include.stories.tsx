// I779 (D134): the parts that show shared rules in the rules, each state side by side on the phone and the desktop: a
// line's block closed, opened in place, its name not found, the shared rules still coming; the editor's Shared
// button and what is not found beside it; the list Insert picks from (none yet too); who uses a shared rule.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { hasLine, lineOf, usedCount } from '../../model/includes'
import { acts } from '../../stories/acts'
import { envOf } from '../../stories/docPage'
import { modelOf } from '../../stories/fixtures'
import { Frames } from '../../stories/Frames'
import { SHARED_RULES, TASKA_RULES, sharedOf } from '../../stories/sharedRulesFixtures'
import { PROJECT_TONES } from '../../ui/tones'
import { IncludeBlock, InsertList, NotFoundHint, SharedButton, UsedBy } from './Include'

export default { title: 'UI/Rules tab/Shared rules/Parts' } satisfies Meta
type Story = StoryObj

const on = acts('Shared rules', ['toggle', 'open', 'pick', 'settings', 'insert', 'project'] as const)
const world = envOf(modelOf([]), true).world
const coding = sharedOf('编程')
const both = (draw: (desk: boolean) => React.ReactNode): Story => ({ render: () => <Frames deskWidth={720} phoneWidth={393}>{(l) => <div className="p-4">{draw(l === 'desk')}</div>}</Frames> })

/** A line read: "Shared rules · 编程 · 3 projects"; a click opens its text in place. */
export const Closed: Story = { ...both(() => <IncludeBlock f={{ label: '编程', md: coding.md, count: usedCount(coding), open: false }} world={world} on={on} />), name: 'A line: closed' }

/** Opened: the shared rule's text in place, as the document draws its own paragraphs. */
export const Opened: Story = { ...both(() => <IncludeBlock f={{ label: '编程', md: coding.md, count: usedCount(coding), open: true }} world={world} on={on} />), name: 'A line: opened in place' }

/** One section of it: {{编程 › 测试}}. */
export const OneSection: Story = {
  ...both(() => <IncludeBlock f={{ label: '编程 › 测试', md: coding.parts[2].md, count: usedCount(coding), open: true }} world={world} on={on} />),
  name: 'A line: one section, opened',
}

/** No shared rules by that name: red, read and edited alike. */
export const NotFound: Story = { ...both(() => <IncludeBlock f={{ label: '编程X', md: null, count: null, open: false }} world={world} on={on} />), name: 'A line: not found' }

/** The shared rules not here yet: the line as written, its count when they come. */
export const Coming: Story = { ...both(() => <IncludeBlock f={{ label: '编程', md: '', count: null, open: false }} world={world} on={on} />), name: 'A line: shared rules still coming' }

/** The editor's buttons: Shared (the desktop: Insert shared rules), and what is not found, in red; nothing wrong: the
 * editor's own hint. */
export const EditorParts: Story = {
  ...both((desk) => (
    <div className="flex flex-col gap-3 text-xs text-zinc-500">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <NotFoundHint labels={[]} hint={desk ? 'Esc keeps draft' : ''} />
        </span>
        <SharedButton onClick={on.insert} />
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <NotFoundHint labels={['编程X', '写作 › 图']} hint="" />
        </span>
        <SharedButton onClick={on.insert} />
      </div>
    </div>
  )),
  name: 'The editor: Shared, and what is not found',
}

const rows = SHARED_RULES.map((r) => ({ name: r.name, line: lineOf(r.name), count: usedCount(r), parts: r.parts.map((p) => ({ name: p.name, line: lineOf(r.name, p.name) })) }))

/** What Insert picks from: each shared rule, how many projects use it, its sections; those in the text ticked. */
export const Insert: Story = { ...both(() => <InsertList rows={rows} has={(l) => hasLine(TASKA_RULES, l)} on={on} />), name: 'Insert: the shared rules and their sections' }

/** None yet: where they are made. */
export const InsertNone: Story = { ...both(() => <InsertList rows={[]} has={() => false} on={on} />), name: 'Insert: none yet' }

/** A shared rule's page, under its text: who puts it in, and the line each has. */
export const UsedByRows: Story = {
  ...both(() => <UsedBy rows={coding.used.map((u, i) => ({ ...u, tone: PROJECT_TONES[i % PROJECT_TONES.length] }))} on={{ open: on.project }} />),
  name: 'Used by',
}

/** No project puts it in yet. */
export const UsedByNone: Story = { ...both(() => <UsedBy rows={[]} on={{ open: on.project }} />), name: 'Used by: none yet' }
