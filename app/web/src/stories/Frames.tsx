// Frames for stories: a part drawn at the phone's width (393) and the desktop's (1440), side by side. Light or dark is
// Storybook's toolbar switch, one at a time (R598). Each frame is a layout container ("@container/frame") of that
// width, so the part lays itself out as it does on that screen; the layout mode comes with it.

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { LayoutProvider, type Layout } from '../app/context'
import { PAGE_BODY } from '../ui/tones'

export interface FrameProps {
  layout: Layout
  width?: number
  height?: number
  label?: string
  /** a page that scrolls as a page (home, dashboard): the page's own grey body, not a pane's white */
  page?: boolean
  children: ReactNode
}

export function Frame({ layout, width, height, label, page = false, children }: FrameProps) {
  const w = width ?? (layout === 'phone' ? 393 : 1440)
  return (
    <figure className="m-0 flex flex-col gap-1">
      {label ? <figcaption className="font-sans text-xs text-zinc-500">{label}</figcaption> : null}
      <div
        data-layout={layout}
        style={{ width: w, height, transform: 'translateZ(0)' }}
        className={`@container/frame relative overflow-hidden ring-1 ring-zinc-300 ${page ? PAGE_BODY : 'bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100'}`}
      >
        <LayoutProvider layout={layout}>{children}</LayoutProvider>
      </div>
    </figure>
  )
}

/** The same part in each frame: phone and desktop. */
export function Frames({ children, phone = true, desk = true, deskWidth, phoneWidth, height, page = false }: {
  children: (layout: Layout) => ReactNode
  phone?: boolean
  desk?: boolean
  deskWidth?: number
  phoneWidth?: number
  height?: number
  page?: boolean
}) {
  return (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {phone ? (
        <Frame layout="phone" width={phoneWidth} height={height} label="phone" page={page}>
          {children('phone')}
        </Frame>
      ) : null}
      {desk ? (
        <Frame layout="desk" width={deskWidth} height={height} label="desktop" page={page}>
          {children('desk')}
        </Frame>
      ) : null}
    </div>
  )
}

/** Several states of one part, each with its name. */
export function States({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="flex flex-col">
      {items.map(([name, node]) => (
        <section key={name} className="border-b border-dashed border-zinc-300 dark:border-zinc-700">
          <div className="px-2 pt-1 font-mono text-[10px] text-zinc-400">{name}</div>
          {node}
        </section>
      ))}
    </div>
  )
}

/** Something done to the page once it is drawn, as you would have done it: a pointer over a part (its mousemove),
 * the contents opened, words selected, words typed into a field, a key pressed in it. */
export function After({ run, children }: { run(root: HTMLElement): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const t = setTimeout(() => ref.current && run(ref.current), 50)
    return () => clearTimeout(t)
  })
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  )
}

/** Types `text` into the field, as the keyboard would (the page hears its input event). */
export function typeInto(field: HTMLInputElement | null, text: string) {
  if (!field || field.value === text) return
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, text)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Presses `key` in the field `n` times. */
export function press(field: HTMLElement | null, key: string, n = 1) {
  for (let i = 0; i < n; i++) field?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}
