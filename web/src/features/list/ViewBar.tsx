// The row of views above the list: the preset views of Items (Needs you, Active, All, Archive, Open, Later,
// Done, Won't do) and your own, each with what it would show. It scrolls sideways; a fading edge says more is there
// (the phone swipes). The desktop's list (F670): Filters at the far left, and when the views do not fit, ⌄ at the far
// right opens the row onto as many lines as it takes to show them all; ⌃ closes it to one line again. Elsewhere on
// the desktop (the search's kinds) an arrow on the edge brings in what is past it.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, StateIcon } from '../../ui/Icon'
import type { ViewChip } from './rows'

export const CHIP =
  'relative flex h-8 shrink-0 items-center gap-1 rounded-full bg-zinc-100 after:absolute after:inset-x-0 after:-inset-y-1.5 px-2 text-[13px] font-medium text-zinc-700 outline-offset-2 outline-blue-500 hover:bg-zinc-200 focus-visible:outline-2 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900'

export interface OwnViewChip {
  name: string
  count: number
  on: boolean
  /** its name being edited here */
  editing?: boolean
}

export function ViewBar({
  views,
  own = [],
  lead,
  more,
  onView,
  onOwn,
  onOwnMenu,
  onRename,
  onRenameStop,
  slid = false,
}: {
  views: ViewChip[]
  own?: OwnViewChip[]
  /** at the far left (the desktop list's Filters) */
  lead?: ReactNode
  /** the desktop list's: the row opened onto all its lines (⌄, ⌃) instead of arrows */
  more?: { open: boolean; toggle(): void }
  onView(value: string): void
  onOwn?(i: number): void
  /** its menu (right-click, or hold on the phone), at the pointer */
  onOwnMenu?(i: number, x: number, y: number): void
  onRename?(i: number, name: string): void
  onRenameStop?(): void
  /** slid to its end when it is drawn (the phone's swipe along it) */
  slid?: boolean
}) {
  const hold = useRef(0)
  const row = useRef<HTMLDivElement>(null)
  const shown = useRef<HTMLButtonElement>(null)
  const [edge, setEdge] = useState({ l: false, r: false, wraps: false })
  const open = !!more?.open
  const measure = () => {
    const el = row.current
    if (!el) return
    const l = el.scrollLeft > 1
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    // opened onto more lines: whether it takes more than one (else there is nothing to close)
    const kids = [...el.children] as HTMLElement[]
    const wraps = kids.length > 1 && kids[kids.length - 1].offsetTop > kids[0].offsetTop
    setEdge((e) => (e.l === l && e.r === r && e.wraps === wraps ? e : { l, r, wraps }))
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
  useEffect(() => {
    const el = row.current
    if (slid && el) el.scrollLeft = el.scrollWidth
  }, [slid])
  // an arrow brings in what is past its edge: the row is the first thing in the bar the arrow is on
  const go = (bar: Element | null, dir: number) => {
    const el = bar?.firstElementChild as HTMLElement | null
    el?.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }
  const fade = (dir: number) => (
    <span
      key="fade"
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 z-10 w-8 from-white to-transparent dark:from-zinc-950 ${more ? '' : 'hidden phone:block'} ${dir < 0 ? 'left-0 bg-linear-to-r' : 'right-0 bg-linear-to-l'}`}
    />
  )
  const arrow = (dir: number) => [
    fade(dir),
    <button
      key="arrow"
      aria-label={dir < 0 ? 'Earlier views' : 'More views'}
      onClick={(e) => go(e.currentTarget.parentElement, dir)}
      className={`absolute inset-y-0 z-10 flex w-12 items-center phone:hidden from-white from-50% to-transparent dark:from-zinc-950 ${dir < 0 ? 'left-0 justify-start bg-linear-to-r pl-1' : 'right-0 justify-end bg-linear-to-l pr-1'}`}
    >
      <span className="grid size-7 place-items-center rounded-full bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-700">
        <Icon n={dir < 0 ? 'left' : 'right'} c="size-4" sw="2.25" />
      </span>
    </button>,
  ]
  // the desktop list's ⌄ / ⌃: only when the views do not fit on one line
  const toggle = more && (open ? edge.wraps : edge.r || edge.l)
  // the lead and ⌄ stay on the first line, centred in it as the chips are
  const side = 'flex h-[calc(var(--spacing-bar)-1px)] shrink-0 items-center'
  const chips = (
    <div
      ref={row}
      onScroll={measure}
      {...(more ? { 'data-views-open': open ? 'true' : 'false' } : {})}
      className={`flex min-h-12 items-center gap-1 px-2 ${open ? 'flex-wrap py-[calc((var(--spacing-bar)-1px-2rem)/2)]' : 'h-full [scrollbar-width:none] overflow-x-auto overflow-y-hidden'}`}
    >
        {views.map((v) => (
          <button key={v.value} ref={v.on ? shown : undefined} aria-pressed={v.on} onClick={() => onView(v.value)} className={CHIP}>
            {v.needs ? <StateIcon s="wait" cls="size-3.5" /> : null}
            {v.label}
            <span className="font-mono text-[11px] tabular-nums opacity-80">{v.count}</span>
          </button>
        ))}
        {own.map((v, i) =>
          v.editing ? (
            <input
              key={v.name}
              autoFocus
              defaultValue={v.name}
              aria-label="View name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename?.(i, e.currentTarget.value)
                if (e.key === 'Escape') onRenameStop?.()
              }}
              onBlur={(e) => onRename?.(i, e.currentTarget.value)}
              className="h-8 w-32 shrink-0 rounded-full bg-white px-3 text-[13px] ring-2 ring-blue-500 outline-none dark:bg-zinc-900"
            />
          ) : (
            <button
              key={v.name}
              ref={v.on ? shown : undefined}
              aria-pressed={v.on}
              onClick={() => onOwn?.(i)}
              onContextMenu={(e) => {
                e.preventDefault()
                onOwnMenu?.(i, e.clientX, e.clientY)
              }}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse') return
                const { clientX: x, clientY: y } = e
                hold.current = window.setTimeout(() => onOwnMenu?.(i, x, y + 8), 500)
              }}
              onPointerUp={() => clearTimeout(hold.current)}
              onPointerLeave={() => clearTimeout(hold.current)}
              className={CHIP}
            >
              {v.name}
              <span className="font-mono text-[11px] tabular-nums opacity-80">{v.count}</span>
            </button>
          ),
        )}
    </div>
  )
  if (!more)
    return (
      // as high as what holds it, at least 48px
      <div data-views className="relative h-full border-b border-zinc-200 dark:border-zinc-800">
        {chips}
        {edge.l ? arrow(-1) : null}
        {edge.r ? arrow(1) : null}
      </div>
    )
  return (
    // the desktop list's: as high as the pane's bar beside it (B669), taller when opened onto more lines
    <div data-views className={`flex border-b border-zinc-200 dark:border-zinc-800 ${open ? 'items-start' : 'h-full items-stretch'}`}>
      {lead ? <div className={`${side} pl-2`}>{lead}</div> : null}
      <div className="relative min-w-0 flex-1">
        {chips}
        {edge.l ? fade(-1) : null}
        {edge.r ? fade(1) : null}
      </div>
      {toggle ? (
        <div className={`${side} pr-2`}>
          <button
            onClick={more.toggle}
            aria-label={open ? 'One line of views' : 'All views'}
            aria-expanded={open}
            className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Icon n={open ? 'chevup' : 'down'} c="size-[18px]" sw="2.25" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
