// What the tooltip's stories share: the page's own Tooltip over the whole window, the pointer on a part (its tip
// shows, as it does after half a second).
import type { StoryObj } from '@storybook/react-vite'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip } from '../app/Tooltip'
import { refCard, type RefCard } from '../model/refCard'
import type { VoiceStep } from '../model/types'
import { Frames } from './Frames'
import { modelOf } from './fixtures'
import { PROJECT } from './listFixtures'

type Story = StoryObj
type Find = string | ((root: HTMLElement) => Element | null | undefined)

export const m = modelOf(PROJECT)

/** A part with the pointer on one of its elements (`find`: a selector, or how to find it, once it is drawn): the page's
 * tooltip shows its tip, drawn over the whole window (outside the frame) as the page's is. */
export function Pointed({ find, card, steps, children }: { find: Find; card(ref: string): RefCard | null; steps?(f: string): Promise<VoiceStep[]>; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    // once what is round it is laid out (the frame says its width above it once it is drawn)
    const point = () => {
      const root = box.current
      const el = root && (typeof find === 'string' ? root.querySelector(find) : find(root))
      setAt(el instanceof HTMLElement ? el : null)
    }
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(point)))
    return () => cancelAnimationFrame(frame)
  }, [find])
  return (
    <>
      <div ref={box} className="contents">
        {children}
      </div>
      {createPortal(<Tooltip card={card} steps={steps} at={at} />, document.body)}
    </>
  )
}

export const one = (part: (desk: boolean) => ReactNode, find: Find, f: { width?: number; height?: number; model?: typeof m; steps?: VoiceStep[] } = {}): Story => ({
  render: () => (
    <Frames phone={false} deskWidth={f.width ?? 900} height={f.height ?? 360}>
      {() => (
        <Pointed find={find} card={(ref) => refCard(f.model ?? m, ref)} steps={() => Promise.resolve(f.steps ?? [])}>
          {part(true)}
        </Pointed>
      )}
    </Frames>
  ),
})
export const button = (row: string, words: string) => (root: HTMLElement) => [...root.querySelectorAll(`${row} button`)].find((b) => b.textContent?.includes(words))
