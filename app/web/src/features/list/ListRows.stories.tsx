import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { item, noRowEvents } from '../../stories/fixtures'
import { ArchiveAllLine, HeldRow, HiddenKidsLine, NeedsMoreLine, Zone } from './ListRows'

const meta: Meta = { title: 'Components/Item list/Lines between rows' }
export default meta
type Story = StoryObj

const on = noRowEvents

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
