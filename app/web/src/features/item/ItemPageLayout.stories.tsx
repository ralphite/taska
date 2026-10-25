// An item's page as you lay it out and edit it (T591: the groups and names Yadong had before the rewrite): editing,
// adding a subitem, full width, two columns, the line between the item and its talk, a reply on its way, the bar's
// buttons under the pointer, focused and pressed. The page's own pane and ItemPage.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frame, Frames } from '../../stories/Frames'
import { item, message } from '../../stories/fixtures'
import { KIDS, PARENT, pageOf, you, type PageOpts } from '../../stories/itemPage'

export default { title: 'Components/Item page/Layout and editing' } satisfies Meta
type Story = StoryObj

const it = (f: Partial<Item> = {}) =>
  item({ n: 12, parent: 3, pri: 'P1', body: 'The export writes **every** row; it should write the rows the list shows.', next: 'Read the filter from the address', thread: [you(1, 'The export should keep the filter I set.'), message({ id: 2, text: 'Reproduced it: the export reads the list before the filter.' })], ...f })
const at = (o: PageOpts, height = 760, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={900} height={height}>{(layout) => pageOf(it(f), layout === 'desk', { others: [PARENT, ...KIDS], ...o })}</Frames>,
})
const desk = (o: PageOpts, width: number): Story => ({
  render: () => (
    <Frame layout="desk" width={width} height={720} label="desktop">
      {pageOf(it(), true, { others: [PARENT, ...KIDS], ...o })}
    </Frame>
  ),
})

export const Editing = at({ f: { editing: true } })
export const AddingASubitem = at({ f: { addingSub: true } })
export const FullWidth = desk({ full: true }, 1400)
export const TwoColumns = desk({ duo: true }, 1400)
export const LinePointerOnIt: Story = { ...at({}), name: 'Line, pointer on it', parameters: { pseudo: { hover: ['[data-grip="top"]'] } } }
export const YourReplyOnItsWay = at({ t: { outgoing: [{ q: 'q1', text: 'Also keep the sort.', state: 'Sending…', bad: false, canUndo: true }] } })
export const PointerKeysPressed: Story = {
  name: 'Pointer, keys, pressed: all side by side',
  parameters: { pseudo: { hover: ['[data-look="pointer"] header button'], focusVisible: ['[data-look="keys"] header button'], active: ['[data-look="pressed"] header button'] } },
  render: () => (
    <div className="flex flex-wrap gap-6">
      {(['pointer', 'keys', 'pressed'] as const).map((look) => (
        <div key={look} data-look={look}>
          <Frame layout="desk" width={900} height={180} label={look === 'keys' ? 'keys (focused)' : look === 'pointer' ? 'under the pointer' : 'pressed'}>
            {pageOf(it(), true, { others: [PARENT] })}
          </Frame>
        </div>
      ))}
    </div>
  ),
}
