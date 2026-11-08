// Your message once it is sent: as it shows, its ⋯ under the pointer (Delete is in it), read by the agent, and the
// items it made (B714 #10594).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, at, later, mine, r4 } from '../../stories/fromYouFixtures'
import { item } from '../../stories/fixtures'

export default { title: 'UI/Item pane/Talk/Message/From you/Sent' } satisfies Meta
type Story = StoryObj

export const YourWords: Story = { ...at([mine()]), name: 'Sent' }
/** The desktop: the pointer on it shows its ⋯ (Edit, Add more and the rest), as on an agent's. */
export const PointerOnIt: Story = { ...at([mine()]), name: 'Pointer on it: ⋯ shows', parameters: { pseudo: { hover: ['.group\\/msg'] } } }
export const ReadByTheAgent: Story = { ...at([mine()], {}, { readBy: { 'claude-code': Date.parse(T) + 30_000 } }), name: 'Read by the agent' }

// B714 #10594: words said here that the organizer made into new items: one line under them, each code opens its item
const ALSO = 'The export should keep the filter I set. Also, on the phone the Export button does nothing at all.'
const PHONE = item({ n: 14, type: 'bug', pri: 'P1', title: 'Export does nothing on the phone', srcs: ['r4'], t0: later(1), body: ALSO })
const SORT = item({ n: 15, type: 'feature', pri: 'P1', title: 'Export keeps the sort', srcs: ['r4'], t0: later(1), body: 'Keep the sort as well.' })
const filed = (touched: number[], msg: string) => r4({ text: ALSO, scope: 12, touched, acked: true, org: { ok: true, msg, t: later(1), keep: false, changed: true, undone: false } })
export const MadeAnItem: Story = {
  ...at([mine({ text: ALSO })], { inputs: [filed([14], 'Created B014')], others: [PHONE] }),
  name: 'Made a new item: → Created',
}
export const MadeTwoItems: Story = {
  ...at([mine({ text: `${ALSO} Keep the sort as well.` })], { inputs: [filed([14, 15], 'Created B014 · Created F015')], others: [PHONE, SORT] }),
  name: 'Made two new items',
}
