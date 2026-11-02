// Dragging the sidebar's projects into your own order, drawn by the page's own drag (orderDrag): a mouse drags at
// once, a finger holds still first. The row you hold is lifted and follows the pointer, the others slide out of its
// way. Each story starts the drag as the pointer would; move the mouse to go on dragging, release to drop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Frame } from '../../stories/Frames'
import { side } from '../../stories/sideFixtures'

export default { title: 'Components/Drag and drop/Projects' } satisfies Meta
type Story = StoryObj

const middle = (root: HTMLElement, slug: string) => {
  const r = root.querySelector(`a[data-slug="${slug}"]`)?.getBoundingClientRect()
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 }
}
const pointer = (type: string, at: { x: number; y: number }, touch: boolean) =>
  new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: touch ? 'touch' : 'mouse', button: 0, clientX: at.x, clientY: at.y })

/** Presses `slug`, holds still on a phone, then moves the pointer to the middle of `to` (or a few pixels). */
function Dragging({ slug, to, touch = false, children }: { slug: string; to?: string; touch?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const timers: number[] = []
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms))
    later(50, () => {
      const from = middle(root, slug)
      root.querySelector(`a[data-slug="${slug}"]`)?.dispatchEvent(pointer('pointerdown', from, touch))
      later(touch ? 500 : 0, () => {
        dispatchEvent(pointer('pointermove', { x: from.x, y: from.y + 8 }, touch))
        if (to) later(30, () => dispatchEvent(pointer('pointermove', middle(root, to), touch)))
      })
    })
    return () => {
      timers.forEach(clearTimeout)
      dispatchEvent(pointer('pointercancel', { x: 0, y: 0 }, touch))
      for (const g of root.ownerDocument.body.querySelectorAll(':scope > a[data-slug][aria-hidden="true"]')) g.remove()
    }
  }, [slug, to, touch])
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  )
}

const desk = (label: string, slug: string, to?: string): Story => ({
  name: label,
  render: () => (
    <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="desk" width={240} height={760} label="desktop">
        <Dragging slug={slug} to={to}>
          {side(false)}
        </Dragging>
      </Frame>
    </div>
  ),
})

export const PickedUp = desk('Picked up with the mouse: lifted, it follows the pointer', 'notes')
export const MovedUp = desk('Moved over another project: the others slide out of its way', 'notes', 'home')
export const MovedDown = desk('Moved down past two projects', 'home', 'notes')
export const OnThePhone: Story = {
  name: 'On the phone: held still, then dragged',
  render: () => (
    <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="phone" width={320} label="phone drawer">
        <Dragging slug="notes" to="home" touch>
          {side(true)}
        </Dragging>
      </Frame>
    </div>
  ),
}
