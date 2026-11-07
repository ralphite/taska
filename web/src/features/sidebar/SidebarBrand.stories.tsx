// The sidebar's brand area (T701): Taska (it opens all projects), Search and Hide sidebar on the desktop, Taska alone
// in the phone's drawer; as it is, under the pointer, pressed. The page's own sidebar, its top.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame } from '../../stories/Frames'
import { side } from '../../stories/sideFixtures'

export default { title: 'UI/Left sidebar/Brand area' } satisfies Meta
type Story = StoryObj

const TASKA = 'a[title="All projects"]'
/** Marks Taska as the page's own code does while you press it. */
const press = (root: HTMLElement) => root.querySelector(TASKA)?.setAttribute('data-pressed', '')
const LOOKS: [label: string, look: string, layout: 'desk' | 'phone'][] = [
  ['as it is', 'plain', 'desk'],
  ['pointer on Taska', 'pointer-taska', 'desk'],
  ['pointer on Search', 'pointer-search', 'desk'],
  ['pointer on Hide sidebar', 'pointer-hide', 'desk'],
  ['Taska pressed', 'pressed', 'desk'],
  ['the phone’s drawer', 'phone', 'phone'],
  ['the phone’s drawer: Taska pressed', 'phone-pressed', 'phone'],
]

/** Each look side by side: the desktop's top of the sidebar, the phone's drawer. */
export const BrandArea: Story = {
  name: 'As it is, pointer, pressed',
  parameters: {
    pseudo: {
      hover: [`[data-look="pointer-taska"] ${TASKA}`, '[data-look="pointer-search"] button[aria-label="Search"]', '[data-look="pointer-hide"] button[aria-label="Hide sidebar"]', `[data-look="pressed"] ${TASKA}`],
      active: [`[data-look="pressed"] ${TASKA}`, `[data-look="phone-pressed"] ${TASKA}`],
    },
  },
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {LOOKS.map(([label, look, layout]) => (
        <Frame key={look} layout={layout} width={layout === 'phone' ? 320 : 240} height={96} label={label}>
          <div data-look={look} className="h-full">
            <After run={look.endsWith('pressed') ? press : () => {}}>{side(layout === 'phone')}</After>
          </div>
        </Frame>
      ))}
    </div>
  ),
}
