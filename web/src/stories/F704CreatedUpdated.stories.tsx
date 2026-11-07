// F704 (r1143): the item page says when the item was created and when it last changed. A proposal, to decide on before
// anything is built: the three directions Gemini proposed, each on the real item page on the phone and the desktop,
// first as it shows, then tapped (the phone) or pointed at (the desktop). The times are ItemTimes'; nothing here
// changes Taska itself. "Updated" is the item's last change of any kind (a field, a message, a document); who made
// it is not always known, so only "created" names who.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../model/types'
import { item, message } from './fixtures'
import { Frames, States } from './Frames'
import { PARENT, pageOf } from './itemPage'
import { Placed, type Times, type Way } from './f704/ItemTimes'

export default { title: 'Prototype/F704 Created and updated', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const NOW = Date.parse('2026-11-06T16:40:00')
const T0 = '2026-11-03T09:12:00'
const T1 = '2026-11-06T14:38:00'

const IT: Item = item({
  n: 641,
  parent: PARENT.n,
  pri: 'P1',
  status: 'doing',
  by: 'org',
  title: '导出时保留当前筛选条件',
  body: '导出现在会写出**所有**行；应该只写列表里看到的行。\n\n- 带上筛选\n- 带上排序',
  next: '从地址栏读取筛选条件',
  srcs: ['r1102', 'r1131'],
  t0: T0,
  t1: T1,
  thread: [
    message({ id: 1, by: 'you', kind: 'say', text: '导出的时候要保留我设的筛选。', t: T0, src: 'r1102' }),
    message({ id: 2, by: 'you', kind: 'say', text: '排序也要保留。', t: '2026-11-04T20:05:00', src: 'r1131' }),
    message({ id: 3, text: 'Reproduced: the export reads the list before the filter. Fixing it in the export button.', t: T1 }),
  ],
})
const X: Times = { t0: T0, t1: T1, by: 'org', now: NOW }

const page = (way: Way, open: boolean) => (
  <Frames phoneWidth={393} deskWidth={900} height={760}>
    {(layout) => (
      <Placed way={way} x={X} desk={layout === 'desk'} open={open}>
        {pageOf(IT, layout === 'desk', { others: [PARENT], env: { now: NOW } })}
      </Placed>
    )}
  </Frames>
)
const story = (way: Way, name: string): Story => ({
  name,
  render: () => (
    <States
      items={[
        ['as it shows', page(way, false)],
        ['tapped (phone) · pointed at (desktop)', page(way, true)],
      ]}
    />
  ),
})

/** a. A quiet line under the title: "Created Nov 3 by Organizer · Updated 2h ago". A tap opens both exact times in
 * place; on the desktop a pointer shows them in the page's tip. */
export const UnderTheTitle = story('a', 'a. Under the title')

/** b. The same words under the chips ("Nov 3 by Organizer · Updated 2h ago"). A tap opens a sheet with both times; on
 * the desktop a pointer shows them in the page's tip. */
export const UnderTheChips = story('b', 'b. Under the chips, a sheet on tap')

/** c. Only "Nov 3 · 2h ago", at the end of the chips' row: no line of its own while the row has room (here the "Part
 * of" chip fills its row, so it wraps to one). A tap, or a pointer on the desktop, opens a small card: created (exact,
 * by whom) and updated. Gemini put it beside the code in the desktop's
 * bar; here it is in the same place on both (F704: the same unless there is a reason). */
export const AtTheEndOfTheChips = story('c', 'c. At the end of the chips, a card on tap')
