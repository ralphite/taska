// The bar over an item's pane: its buttons under the pointer, from the keys and pressed; the way back to an item; no bar
// beside a side list; the phone's Back and ⋯ pressed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame, Frames } from '../../stories/Frames'
import { PARENT, pageOf } from '../../stories/itemPage'
import { frame, it, newInputHead } from '../../stories/itemPageLayoutFixtures'
import { BackTo, NoSelection } from './ItemPage'
import { act } from '../../stories/acts'

export default { title: 'UI/Item pane/Bar' } satisfies Meta
type Story = StoryObj

export const PointerKeysPressed: Story = {
  name: 'Its buttons: pointer, keys, pressed',
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
/** the phone's Back and ⋯ pressed */
export const PhonePressed: Story = {
  name: 'Phone: Back and ⋯ pressed',
  render: () => (
    <Frames desk={false} phoneWidth={393}>
      {() => <After run={(root) => root.querySelectorAll('header button').forEach((b) => b.setAttribute('data-pressed', ''))}>{frame({ head: <span className="font-mono text-sm font-bold">F012</span>, menu: true, onMenu: act('Pane: menu → Menus and sheets › Item menu') }, false)}</After>}
    </Frames>
  ),
}
/** Scrolled on the phone: the title has gone up out of sight, so the bar says it after the code, on the code's one
 * line, cut short between Back and ⋯ (B696). */
export const ScrolledTitle: Story = {
  name: 'Phone: Scrolled: the title beside the code, one line',
  render: () => <Frames desk={false} phoneWidth={393} height={300}>{() => pageOf(it({ title: 'The export keeps the filter I set, also when it runs from the phone' }), false, { others: [PARENT], titled: true })}</Frames>,
}
export const BackToAnItem: Story = { name: 'Back to an item', render: () => <Frames phoneWidth={393} deskWidth={720} height={260}>{() => <BackTo label="F012" onBack={act('Pane: back to F012')} />}</Frames> }
/** New input opened from an item: its bar says New input and, at its end, the way back to that item */
export const NewInputFromAnItem: Story = { name: 'New input, opened from an item: Back to F012', render: () => <Frames phone={false} deskWidth={720}>{() => frame({ head: newInputHead, nav: <BackTo label="F012" onBack={act('Pane: back to F012')} /> }, true)}</Frames> }
/** a side list open on the desktop and nothing picked: the pane has no bar */
export const NoBarBesideASideList: Story = { name: 'Beside a side list: no bar', render: () => <Frames phone={false} deskWidth={720}>{() => frame({ bar: false }, true, <NoSelection side="docs" />)}</Frames> }
