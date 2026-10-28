// The picture viewer: one picture at a time with the others of the same message, fit to the screen or at 100%. Like
// a photo app: a tap on the dark area closes; on a phone, at fit size, a sideways swipe goes to the next or previous
// picture and a swipe down closes; two fingers zoom the picture, never the page. Props only.

import { useLayoutEffect, useRef } from 'react'
import { Icon } from '../../ui/Icon'

export interface ViewerEvents {
  close(): void
  prev(): void
  next(): void
  zoom(): void
}

export function Viewer({ open, name, url, idx, count, fit, on }: { open: boolean; name: string; url: string; idx: number; count: number; fit: boolean; on: ViewerEvents }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const touch = useRef({ x: 0, y: 0, on: false, d0: 0, d1: 0 })
  useLayoutEffect(() => {
    const v = ref.current
    if (!v) return
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const move = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      touch.current.d0 ||= dist(e.touches)
      touch.current.d1 = dist(e.touches)
    }
    const gest = (e: Event) => e.preventDefault() // Safari's own pinch
    v.addEventListener('touchmove', move, { passive: false })
    v.addEventListener('gesturestart', gest)
    return () => {
      v.removeEventListener('touchmove', move)
      v.removeEventListener('gesturestart', gest)
    }
  }, [])
  useLayoutEffect(() => {
    if (open) requestAnimationFrame(() => close.current?.focus())
  }, [open])
  return (
    <div
      ref={ref}
      hidden={!open}
      className="fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)] text-white"
      onTouchEnd={(e) => {
        const t = touch.current
        if (!t.d0 || e.touches.length) return
        const r = t.d1 / t.d0
        t.d0 = t.d1 = 0
        if (fit ? r > 1.2 : r < 0.83) on.zoom()
      }}
    >
      <header className="flex items-center gap-2 px-2 py-1 text-sm">
        <span className="min-w-0 flex-1 truncate pl-2">{name}</span>
        <span className="text-white/60">{count > 1 ? `${idx + 1} / ${count}` : ''}</span>
        <a href={url || undefined} target="_blank" rel="noopener" className="flex h-11 items-center rounded-full px-3 text-white/80 hover:bg-white/10">
          Open file
        </a>
        <button ref={close} onClick={on.close} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-white/10">
          <Icon n="x" />
        </button>
      </header>
      <div
        className="flex min-h-0 flex-1 overflow-auto lg:scrollbar-thumb-white/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) on.close()
        }}
        onTouchStart={(e) => {
          const t = touch.current
          t.on = e.touches.length === 1 && fit
          if (t.on) {
            t.x = e.touches[0].clientX
            t.y = e.touches[0].clientY
          }
        }}
        onTouchEnd={(e) => {
          const t = touch.current
          if (!t.on) return
          t.on = false
          const c = e.changedTouches[0]
          const dx = c.clientX - t.x
          const dy = c.clientY - t.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) (dx < 0 ? on.next : on.prev)()
          else if (dy > 80 && dy > 1.5 * Math.abs(dx)) on.close()
        }}
      >
        {open && url ? <img key={url} src={url} alt="" className={fit ? 'm-auto max-h-full max-w-full object-contain' : 'm-auto max-w-none'} /> : null}
      </div>
      <footer className="flex items-center justify-center gap-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-sm">
        <button onClick={on.prev} disabled={idx === 0} className="h-11 rounded-full px-4 hover:bg-white/10">
          Previous
        </button>
        <button onClick={on.zoom} className="h-11 rounded-full bg-white/10 px-4 hover:bg-white/20">
          {fit ? 'Zoom to 100%' : 'Fit to screen'}
        </button>
        <button onClick={on.next} disabled={idx >= count - 1} className="h-11 rounded-full px-4 hover:bg-white/10">
          Next
        </button>
      </footer>
    </div>
  )
}
