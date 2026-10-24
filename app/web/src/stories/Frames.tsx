// Frames for stories: a part drawn at the phone's width (393) and the desktop's (1440), light and dark, side by side.
// Each frame is a layout container ("@container/frame") of that width, so the part lays itself out as it does on that
// screen; the layout mode comes with it.

import type { ReactNode } from 'react'
import { LayoutProvider, type Layout } from '../app/context'

export interface FrameProps {
  layout: Layout
  theme?: 'light' | 'dark'
  width?: number
  height?: number
  label?: string
  children: ReactNode
}

export function Frame({ layout, theme = 'light', width, height, label, children }: FrameProps) {
  const w = width ?? (layout === 'phone' ? 393 : 1440)
  return (
    <figure className="m-0 flex flex-col gap-1">
      {label ? <figcaption className="font-sans text-xs text-zinc-500">{label}</figcaption> : null}
      <div
        data-theme={theme}
        data-layout={layout}
        style={{ width: w, height, transform: 'translateZ(0)' }}
        className="@container/frame relative overflow-hidden bg-white text-zinc-900 antialiased ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <LayoutProvider layout={layout}>{children}</LayoutProvider>
      </div>
    </figure>
  )
}

/** The same part in each frame: phone and desktop, light and dark. */
export function Frames({ children, phone = true, desk = true, deskWidth, phoneWidth, height }: {
  children: (layout: Layout) => ReactNode
  phone?: boolean
  desk?: boolean
  deskWidth?: number
  phoneWidth?: number
  height?: number
}) {
  return (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6">
      {(['light', 'dark'] as const).map((theme) => (
        <div key={theme} className="flex items-start gap-6">
          {phone ? (
            <Frame layout="phone" theme={theme} width={phoneWidth} height={height} label={`phone · ${theme}`}>
              {children('phone')}
            </Frame>
          ) : null}
          {desk ? (
            <Frame layout="desk" theme={theme} width={deskWidth} height={height} label={`desktop · ${theme}`}>
              {children('desk')}
            </Frame>
          ) : null}
        </div>
      ))}
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
