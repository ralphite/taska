import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { DocPaneActs, DocPaneHead, DocPaneNav } from './DocPane'

const meta: Meta = { title: 'Components/Document/Reading' }
export default meta
type Story = StoryObj

const on = { inspect() {}, edit() {}, move() {}, remove() {} }
const bar = (children: React.ReactNode) => <div className="flex h-14 items-center gap-1 border-b border-zinc-200 px-3 dark:border-zinc-800">{children}</div>

/** Reading a document, a web page in Comment mode with Delete asking, and editing. */
export const Bars: Story = {
  name: 'The pane’s bar: a document, a web page, being edited',
  render: () => (
    <Frame layout="desk" width={900} height={200}>
      {bar(
        <>
          <DocPaneNav to="F012" onBack={() => {}} />
          <DocPaneHead d={{ d: 12, title: 'The rewrite plan', fmt: 'md' }} editing={false} />
          <span className="flex-1" />
          <DocPaneActs web={false} inspect={false} deleting={false} d={12} on={on} />
        </>,
      )}
      {bar(
        <>
          <DocPaneNav to="Documents" onBack={() => {}} />
          <DocPaneHead d={{ d: 13, title: 'How the old page looks', fmt: 'html' }} editing={false} />
          <span className="flex-1" />
          <DocPaneActs web inspect deleting d={13} on={on} />
        </>,
      )}
      {bar(<DocPaneHead d={{ d: 12, title: 'The rewrite plan', fmt: 'md' }} editing />)}
    </Frame>
  ),
}
