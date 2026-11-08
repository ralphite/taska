// What the tooltip's stories share: the page's own Tooltip over the whole window, with the pointer put on a part as you
// would (it shows after half a second).
import type { StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { Tooltip } from '../app/Tooltip'
import { refCard } from '../model/refCard'
import type { VoiceStep } from '../model/types'
import { After, Frames } from './Frames'
import { modelOf } from './fixtures'
import { PROJECT } from './listFixtures'

type Story = StoryObj

export const m = modelOf(PROJECT)
/** The tooltip is drawn over the whole window, outside the frame, as the page's is (it is placed where the part is on
 * the screen). */
export const one = (part: (desk: boolean) => ReactNode, find: string | ((root: HTMLElement) => Element | null | undefined), f: { width?: number; height?: number; model?: typeof m; steps?: VoiceStep[]; pageTip?: boolean } = {}): Story => ({
  render: () => (
    <>
      <Frames phone={false} deskWidth={f.width ?? 900} height={f.height ?? 360}>
        {() => <After run={(root) => (typeof find === 'string' ? root.querySelector(find) : find(root))?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))}>{part(true)}</After>}
      </Frames>
      {/* a part that is a whole page (an item's talk) has the page's own tooltip (`pageTip`) */}
      {f.pageTip ? null : <Tooltip card={(ref) => refCard(f.model ?? m, ref)} steps={() => Promise.resolve(f.steps ?? [])} />}
    </>
  ),
})
export const button = (row: string, words: string) => (root: HTMLElement) => [...root.querySelectorAll(`${row} button`)].find((b) => b.textContent?.includes(words))

