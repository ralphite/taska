// The page's tooltip (T591: Floating > Tip): its words in the page's own look, a key at the end as a key cap, beside
// the sidebar's buttons, under the heads' buttons, above the rest; on a code, a card about what it names. The page's
// own Tooltip, with the pointer put on the part as you would (it shows after half a second).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { Tooltip } from '../app/Tooltip'
import { refCard } from '../model/refCard'
import { After, Frames } from './Frames'
import { headOf } from './headFixtures'
import { item, message, modelOf } from './fixtures'
import { talkOf } from './itemPage'
import { listOf, PROJECT } from './listFixtures'
import { rail, side } from './sideFixtures'

export default { title: 'Components/Floating/Tip' } satisfies Meta
type Story = StoryObj

const point = (sel: string) => (root: HTMLElement) => root.querySelector(sel)?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
const m = modelOf(PROJECT)
const one = (part: (desk: boolean) => ReactNode, sel: string, f: { phone?: boolean; width?: number; height?: number } = {}): Story => ({
  render: () => (
    <Frames phone={false} deskWidth={f.width ?? 900} height={f.height ?? 360}>
      {() => (
        <After run={point(sel)}>
          {part(true)}
          <Tooltip card={(ref) => refCard(m, ref)} />
        </After>
      )}
    </Frames>
  ),
})

export const OnApprove: Story = { ...one(() => listOf(PROJECT, 'items', {}, true), '[data-n="3"] button[data-tip], [data-n="3"] button[title]', { height: 520 }), name: 'On Approve, in a row that waits on you' }
export const OnHideSidebar: Story = { ...one(() => <div className="h-full w-60">{side(false)}</div>, 'button[aria-label="Hide the sidebar"]', { height: 520 }), name: 'On Hide the sidebar' }
export const OnRailProject: Story = { ...one(() => <div className="h-full w-14">{rail()}</div>, '#rail a[aria-label="Home"]', { height: 520 }), name: 'On a project in the rail' }
export const OnRailSettings: Story = { ...one(() => <div className="h-full w-14">{rail()}</div>, '#rail button[aria-label="Settings"]', { height: 520 }), name: 'On Settings in the rail' }
export const OnFilters: Story = { ...one(() => headOf(true), 'button[aria-label="Filters"]', { width: 1100, height: 240 }), name: 'On Filters' }
/** A code in some words: a card about what it names. */
export const OnCode: Story = {
  ...one(() => talkOf(item({ n: 1, thread: [message({ id: 1, text: 'The sort is in F005, the file name in F003.' })] }), true, { others: PROJECT.filter((it) => it.n !== 1) }), '[data-ref="F005"]', { height: 420 }),
  name: 'On a code: what it names',
}
