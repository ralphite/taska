import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, Hold, States } from '../../stories/Frames'
import { act } from '../../stories/menuFixtures'
import { item, noRowEvents } from '../../stories/fixtures'
import { ArchiveAllLine, HeldRow, HiddenKidsLine, NeedsMoreLine, Zone } from './ListRows'

const meta: Meta = { title: 'Components/Item list/Lines between rows' }
export default meta
type Story = StoryObj

const on = noRowEvents

/** The quiet line a row becomes while the list holds still, and the list's other lines. */
export const Lines: Story = {
  name: 'Held rows, group heads, hidden subitems, show more, archive them',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['held: approved', <HeldRow it={item({ n: 12, status: 'open' })} code="F012" said="Approved" height={64} on={on} />],
            ["held: marked won't do", <HeldRow it={item({ n: 12, status: 'dropped' })} code="F012" said="Won't do" height={64} on={on} />],
            ['zone: needs you', <Zone kind="needs" label="Needs you" n={3} />],
            ['zone: rules', <Zone kind="rules" label="Active" n={12} />],
            ['zone: retired', <Zone kind="retired" label="Retired" n={2} />],
            ['hidden subitems: in Later', <Hold start={false}>{(open, set) => <HiddenKidsLine parent={1} depth={1} open={open} later={2} onToggle={() => set(!open)} />}</Hold>],
            ['hidden subitems: shown', <Hold<boolean> start>{(open, set) => <HiddenKidsLine parent={1} depth={1} open={open} later={2} onToggle={() => set(!open)} />}</Hold>],
            ['needs you: show more', <Hold start={false}>{(open, set) => <NeedsMoreLine open={open} rest={4} onToggle={() => set(!open)} />}</Hold>],
            ['needs you: show fewer', <Hold<boolean> start>{(open, set) => <NeedsMoreLine open={open} rest={4} onToggle={() => set(!open)} />}</Hold>],
            ['finished: archive them', <ArchiveAllLine n={7} onArchive={act('List: archive all')} />],
          ]}
        />
      )}
    </Frames>
  ),
}
