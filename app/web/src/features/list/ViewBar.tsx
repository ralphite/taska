// The row of views above the list: the preset views of Items (Needs you, Active, All, Archive, Queue, Later,
// Finished) and your own, each with what it would show. It scrolls sideways; an arrow on a fading edge says more is
// there, and a click brings it in.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../../ui/Icon'
import type { ViewChip } from './rows'

const CHIP =
  'flex h-8 shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900'

export interface OwnViewChip {
  name: string
  count: number
  on: boolean
}

export function ViewBar({
  views,
  own = [],
  onView,
  onOwn,
}: {
  views: ViewChip[]
  own?: OwnViewChip[]
  onView(value: string): void
  onOwn?(i: number): void
}) {
  const row = useRef<HTMLDivElement>(null)
  const shown = useRef<HTMLButtonElement>(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  const measure = () => {
    const el = row.current
    if (!el) return
    const l = el.scrollLeft > 1
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }))
  }
  useLayoutEffect(measure)
  useEffect(() => {
    const el = row.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const on = views.find((v) => v.on)?.value ?? own.findIndex((v) => v.on)
  useEffect(() => {
    // the view that shows is never hidden past the edge or under an arrow (48px wide)
    const el = row.current
    const b = shown.current
    if (!el || !b) return
    const l = b.offsetLeft - 48
    const r = b.offsetLeft + b.offsetWidth + 48 - el.clientWidth
    if (el.scrollLeft > l) el.scrollLeft = Math.max(0, l)
    else if (el.scrollLeft < r) el.scrollLeft = r
  }, [on])
  const go = (dir: number) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.7, behavior: 'smooth' })
  const arrow = (dir: number) => (
    <button
      aria-label={dir < 0 ? 'Earlier views' : 'More views'}
      onClick={() => go(dir)}
      className={`absolute inset-y-0 z-10 flex w-12 items-center from-white from-50% to-transparent dark:from-zinc-950 ${dir < 0 ? 'left-0 justify-start bg-linear-to-r pl-1' : 'right-0 justify-end bg-linear-to-l pr-1'}`}
    >
      <span className="grid size-7 place-items-center rounded-full bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-700">
        <Icon n={dir < 0 ? 'left' : 'right'} c="size-4" sw="2.25" />
      </span>
    </button>
  )
  return (
    <div className="relative border-b border-zinc-200 dark:border-zinc-800">
      <div ref={row} onScroll={measure} className="flex h-12 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-2">
        {views.map((v) => (
          <button key={v.value} ref={v.on ? shown : undefined} aria-pressed={v.on} onClick={() => onView(v.value)} className={CHIP}>
            {v.dot ? <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400" /> : null}
            {v.label}
            <span className="font-mono text-[11px] tabular-nums opacity-60">{v.count}</span>
          </button>
        ))}
        {own.map((v, i) => (
          <button key={v.name} ref={v.on ? shown : undefined} aria-pressed={v.on} onClick={() => onOwn?.(i)} className={CHIP}>
            {v.name}
            <span className="font-mono text-[11px] tabular-nums opacity-60">{v.count}</span>
          </button>
        ))}
      </div>
      {edge.l ? arrow(-1) : null}
      {edge.r ? arrow(1) : null}
    </div>
  )
}
