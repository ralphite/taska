// F839 (Yadong r1441 r1443): a document's diagram or table seen on the whole window. Its button at the top right shows
// when it is pointed at on the desktop and always on the phone; it opens it over everything, the width of the window,
// scrolling either way; × or Esc closes it. On the whole window a table reads as a table on the phone too.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../stories/Frames'
import { item, modelOf } from '../stories/fixtures'
import { talkEnv } from '../stories/itemFixtures'
import { blocks, type MdBlock } from '../model/markdown'
import { FullView } from './FullView'
import { Diagram, Rich, Table } from './Markdown'

export default { title: 'Base components/Markdown/Full screen' } satisfies Meta
type Story = StoryObj

const world = talkEnv(modelOf([item({ n: 12 })]), true).world
const DIAGRAM = 'graph TD\n  A[You say it] --> B[Organizer files it]\n  B --> C{Agent picks it up}\n  C -->|done| D[Review]\n  C -->|question| E[Needs you]'
const TABLE = '| Step | Who | Where | When |\n|---|---|---|---|\n| Say it | You | Input box | Any time |\n| File it | Organizer | Items | In seconds |\n| Do it | Agent | Its session | When it is free |'
const table = blocks(TABLE).find((b): b is Extract<MdBlock, { kind: 'table' }> => b.kind === 'table')!

/** In the document: the button at the top right, always on the phone, when pointed at on the desktop. */
export const InTheDocument: Story = {
  render: () => <Frames phoneWidth={393} deskWidth={720}>{() => <Rich text={`The flow:\n\n\`\`\`mermaid\n${DIAGRAM}\n\`\`\`\n\nWho does what:\n\n${TABLE}`} world={world} />}</Frames>,
  name: 'In the document',
}

/** Opened: the diagram the width of the window. */
export const DiagramOpen: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <FullView label="Diagram" open full={<Diagram src={DIAGRAM} draw={world.diagram!} wide />}>
      <Diagram src={DIAGRAM} draw={world.diagram!} />
    </FullView>
  ),
  name: 'A diagram opened',
}

/** Opened: a table as a table (on the phone too, where the document shows it as cards), scrolling sideways. */
export const TableOpen: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <FullView label="Table" open full={<Table b={table} world={world} flat />}>
      <Table b={table} world={world} />
    </FullView>
  ),
  name: 'A table opened',
}
