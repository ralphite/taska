// The frame of every sheet (Sheet): a handle (the phone drags it down to close) around what it holds. What it holds
// is laid out by SheetLayout: a title row (or a head), extra buttons beside the close button, an optional line under
// it, the body that scrolls and a fixed foot. A menu on the desktop pops at a spot instead, with no title row and no
// close button (a click outside or Esc closes it). Props only; it places itself from its own size.

import { createContext, useContext, useLayoutEffect, useRef, type ReactNode, type Ref, type RefObject } from 'react'
import { Icon } from './Icon'

export interface SheetLook {
  pop?: boolean
  narrow?: boolean
  tall?: boolean
  card?: boolean
  aboveComposer?: boolean
  at?: { x: number; y: number; right?: boolean; top?: number; left?: number } | null
}

export interface SheetParts {
  /** a menu: no title row on the desktop */
  menu?: boolean
  title?: string
  head?: ReactNode
  extra?: ReactNode
  sub?: ReactNode
  foot?: ReactNode
  body: ReactNode
}

const CloseX = () => (
  <span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700 dark:group-hover:text-zinc-200">
    <Icon n="x" c="size-4" sw="2.25" />
  </span>
)

/** What the frame tells what it holds: whether it pops at a spot, how it closes, its close button. */
const Frame = createContext<{ pop: boolean; onClose(): void; close: RefObject<HTMLButtonElement | null>; bodyRef?: Ref<HTMLDivElement> }>({ pop: false, onClose: () => {}, close: { current: null } })

/** What a sheet holds, laid out in its frame. */
export function SheetLayout({ menu, title, head, extra, sub, foot, body }: SheetParts) {
  const { pop, onClose, close, bodyRef } = useContext(Frame)
  return (
    <>
      <header data-tip-side="bottom" className={`flex shrink-0 touch-none items-center gap-2 py-1 pr-2 pl-5 ${(head || title) && !(pop && menu) ? '' : 'lg:hidden'}`}>
        <h2 id="dlgTitle" className="min-w-0 flex-1 truncate text-[17px] font-semibold">
          {head ?? title ?? ''}
        </h2>
        <span className="contents">{extra}</span>
        <button ref={close} onClick={onClose} aria-label="Close" className={`group grid size-11 shrink-0 place-items-center rounded-full ${pop ? 'lg:hidden' : ''}`}>
          <CloseX />
        </button>
      </header>
      <div hidden={!sub} className="shrink-0">
        {sub}
      </div>
      <div
        ref={bodyRef}
        className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 lg:scrollbar-thin lg:overscroll-contain lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${foot ? 'pb-3' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'}`}
      >
        {body}
      </div>
      <div hidden={!foot} className="shrink-0">
        {foot}
      </div>
    </>
  )
}

export function Sheet({ open, look, parts, children, desk, footRoom = 0, focus = false, bodyRef, onClose }: {
  open: boolean
  look: SheetLook
  /** what it holds, as parts (or as `children` that lay themselves out with SheetLayout) */
  parts?: SheetParts | null
  children?: ReactNode
  desk: boolean
  /** room the box takes at the bottom, for a sheet above it */
  footRoom?: number
  focus?: boolean
  /** the body that holds its buttons (a menu's keys walk them) */
  bodyRef?: Ref<HTMLDivElement>
  onClose(): void
}) {
  const overlay = useRef<HTMLDivElement>(null)
  const dlg = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const drag = useRef({ id: 0, y0: 0, dy: 0, on: false })
  useLayoutEffect(() => {
    const o = overlay.current
    const d = dlg.current
    if (!o || !d || !open) return
    o.style.bottom = look.aboveComposer ? footRoom + 'px' : ''
    d.style.height = look.tall && look.aboveComposer && !desk ? `calc(88dvh - ${footRoom}px)` : ''
    // a menu sits at the pointer, or under the button it came from, kept on screen
    const xy = look.at
    if (xy && desk) {
      const x = !xy.right ? xy.x : (xy.left ?? 0) + d.offsetWidth <= innerWidth - 8 ? (xy.left ?? 0) : xy.x - d.offsetWidth
      const y = xy.right && xy.y + d.offsetHeight > innerHeight - 8 ? (xy.top ?? 0) - d.offsetHeight - 4 : xy.y
      o.style.paddingLeft = `${Math.max(8, Math.min(x, innerWidth - d.offsetWidth - 8))}px`
      o.style.paddingTop = `${Math.max(8, Math.min(y, innerHeight - d.offsetHeight - 8))}px`
    } else o.style.paddingLeft = o.style.paddingTop = ''
  })
  useLayoutEffect(() => {
    // no ring on opening
    if (open && focus && desk) close.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
  }, [open, focus, desk])
  if (!open || !(parts || children)) return <div ref={overlay} hidden />
  const card = !!look.card
  const pop = !!look.pop && desk
  const flush = card && !!look.aboveComposer
  const oCls = [
    'fixed inset-0 z-40 flex items-end justify-center bg-black/40 pt-[max(env(safe-area-inset-top),0.75rem)] sm:items-center sm:p-6 dark:bg-black/60',
    card ? 'px-2' : '',
    card && !flush ? 'pb-2' : '',
    pop ? (look.at ? 'lg:items-start lg:justify-start lg:bg-transparent dark:lg:bg-transparent' : 'lg:items-start lg:justify-end lg:bg-transparent dark:lg:bg-transparent lg:pt-[3.75rem] lg:pr-3') : '',
  ].join(' ')
  const dCls = [
    'flex max-h-[min(88dvh,100%)] w-full max-w-2xl flex-col bg-white shadow-xl transition-transform duration-150 sm:rounded-3xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10',
    look.tall ? 'h-[88dvh] sm:h-[85dvh]' : '',
    card ? 'shadow-2xl overflow-hidden max-h-[92%]' : 'max-h-[88dvh]',
    card && !flush ? 'rounded-3xl' : 'rounded-t-3xl',
    pop ? `${look.narrow ? 'lg:w-56' : 'lg:w-[24rem]'} lg:max-h-[80dvh] lg:rounded-2xl lg:ring-1 lg:ring-zinc-900/10 dark:lg:ring-white/10` : '',
  ].join(' ')
  const dragEnd = () => {
    const g = drag.current
    if (!g.on) return
    g.on = false
    const d = dlg.current
    if (d) d.style.transition = d.style.transform = ''
    if (g.dy > 80) onClose()
  }
  return (
    <div
      ref={overlay}
      data-card={card ? '1' : ''}
      data-above={look.aboveComposer ? '1' : ''}
      className={oCls}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        ref={dlg}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlgTitle"
        className={dCls}
        onPointerDown={(e) => {
          const t = e.target as Element
          if (e.pointerType === 'mouse' || !t.closest('[data-handle], header') || t.closest('button')) return
          drag.current = { id: e.pointerId, y0: e.clientY, dy: 0, on: true }
          if (dlg.current) dlg.current.style.transition = 'none'
        }}
        onPointerMove={(e) => {
          const g = drag.current
          if (!g.on || e.pointerId !== g.id) return
          g.dy = Math.max(0, e.clientY - g.y0)
          if (dlg.current) dlg.current.style.transform = g.dy ? `translateY(${g.dy}px)` : ''
        }}
        onPointerUp={dragEnd}
        onPointerCancel={dragEnd}
      >
        <div data-handle className="flex shrink-0 touch-none justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <Frame.Provider value={{ pop, onClose, close, bodyRef }}>{parts ? <SheetLayout {...parts} /> : children}</Frame.Provider>
      </section>
    </div>
  )
}
