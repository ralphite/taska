import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames } from '../stories/Frames'
import { act } from '../stories/menuFixtures'
import { PRIMARY } from './tones'
import { Sheet, SheetLayout } from './Sheet'

const meta: Meta = { title: 'Base components/Sheets' }
export default meta
type Story = StoryObj

const parts = {
  title: 'Move to project',
  sub: <p className="px-5 pb-2 text-sm text-zinc-500">F012 and its 2 subitems go along.</p>,
  body: <p className="text-[15px]">The body scrolls when it is long.</p>,
  foot: (
    <div className="flex justify-end border-t border-zinc-100 p-3 dark:border-zinc-800">
      <button className={PRIMARY}>Move</button>
    </div>
  ),
}

/** A sheet from the bottom on the phone, a dialog on the desktop: title, line under it, body, foot. */
export const Frame: Story = {
  name: "A sheet's frame: phone and desktop",
  render: () => <Frames height={420} deskWidth={900}>{(layout) => <Sheet open look={{}} desk={layout === 'desk'} onClose={act('Sheet: close')}><SheetLayout {...parts} /></Sheet>}</Frames>,
}
// ---- more states (T639)
/** the desktop's menu popped with no spot (All actions by its key, Put under… by M): top right under the bar */
export const PoppedNoSpot: Story = {
  name: 'A desktop menu with no spot: top right under the bar',
  render: () => <Frames phone={false} height={420} deskWidth={900}>{() => <Sheet open look={{ pop: true }} desk onClose={act('Sheet: close')}><SheetLayout title="All actions" menu body={<p className="text-[15px]">Done · Later · Archive …</p>} /></Sheet>}</Frames>,
}
/** the phone's sheet dragged down by its handle, as the finger moves it (let go far enough, it closes) */
export const DraggedDown: Story = {
  name: 'Phone: Dragged down by its handle',
  render: () => (
    <Frames desk={false} height={520}>
      {() => (
        <After run={(root) => root.querySelector<HTMLElement>('[role="dialog"]')?.style.setProperty('transform', 'translateY(90px)')}>
          <Sheet open look={{}} desk={false} onClose={act('Sheet: close')}><SheetLayout {...parts} /></Sheet>
        </After>
      )}
    </Frames>
  ),
}
