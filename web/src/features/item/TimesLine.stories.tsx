// When an item was made and when it last changed (F704 r1157): one quiet line under its chips, "Oct 20 by Organizer ·
// Updated 2h ago" (who made it when known; how long ago it changed). On the phone a tap opens both in full in a sheet;
// on the desktop the pointer shows them in the page's tip. "Updated" is its last change of any kind (a field, a
// message, a document); none when it has not changed since it was made. TimesLine, in the page's own pane and ItemPage.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { Pointed } from '../../stories/tipFixtures'
import { T, input, message } from '../../stories/fixtures'
import { PARENT, pageOf } from '../../stories/itemPage'
import { base, said } from '../../stories/itemPageFixtures'

export default { title: 'UI/Item pane/Whole/When made and updated' } satisfies Meta
type Story = StoryObj

const ago = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const MADE = ago(3 * 1440 + 318) // Oct 20 09:12
const CHANGED = base({
  status: 'doing',
  by: 'org',
  t0: MADE,
  t1: ago(120),
  thread: [{ ...said, t: MADE }, message({ id: 2, text: 'Reproduced: the export reads the list before the filter. Fixing it in the export button.', t: ago(120) })],
})
const NOT_CHANGED = base({ by: null, t0: MADE, t1: MADE, thread: [{ ...said, t: MADE }] })
const o = { others: [PARENT], inputs: [input({ id: 'r4', t: MADE, acked: true, touched: [12] })] }
const LINE = '[data-part="item-times"]'

export const MadeAndUpdated: Story = {
  name: 'Made and updated',
  render: () => (
    <States
      items={[
        ['changed since it was made', <Frames key="a" phoneWidth={393} deskWidth={900} height={560}>{(layout) => pageOf(CHANGED, layout === 'desk', o)}</Frames>],
        ['not changed since, who made it not known', <Frames key="b" phoneWidth={393} deskWidth={900} height={560}>{(layout) => pageOf(NOT_CHANGED, layout === 'desk', o)}</Frames>],
      ]}
    />
  ),
}

/** The phone: the line tapped, both times in a sheet. */
export const PhoneTapped: Story = {
  name: 'Phone: tapped, both in a sheet',
  render: () => (
    <Frames desk={false} phoneWidth={393} height={760}>
      {() => pageOf(CHANGED, false, { ...o, timesOpen: true })}
    </Frames>
  ),
}

/** The desktop: the pointer on the line, both times in the page's tip. */
export const DesktopPointerOnIt: Story = {
  name: 'Desktop: pointer on it, both in the tip',
  render: () => (
    <Frames phone={false} deskWidth={1440} height={560}>
      {() => (
        <Pointed find={LINE} card={() => null}>
          {pageOf(CHANGED, true, o)}
        </Pointed>
      )}
    </Frames>
  ),
}
