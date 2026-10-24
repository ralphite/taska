// A line you can drag (a pane's edge, the line between an item and its talk): pointed at or dragged, the line itself
// turns blue. Dragging gives the size from where its pane starts to the pointer; a double-click puts it back (not the
// line under an item, which stays where you put it). A button on the line is a button. Props only.

import { useRef, useState } from 'react'

export function Grip({ axis, place, measure, onSize, onDone, onReset }: {
  axis: 'x' | 'y'
  /** where it sits and how wide its pointing area is */
  place: string
  /** where its pane starts on the screen, and how far it may go (from the line's own element) */
  measure(el: HTMLElement): { from: number; most: number }
  onSize(px: number): void
  onDone(px: number): void
  onReset?(): void
}) {
  const [drag, setDrag] = useState(false)
  const at = useRef({ from: 0, most: 0, px: 0 })
  return (
    <div
      {...(drag ? { 'data-drag': '' } : {})}
      onPointerDown={(e) => {
        if (e.button || (e.target as Element).closest('button')) return
        e.preventDefault()
        at.current = { ...measure(e.currentTarget), px: 0 }
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag(true)
        document.body.classList.add('select-none', axis === 'y' ? 'cursor-row-resize' : 'cursor-col-resize')
      }}
      onPointerMove={(e) => {
        if (!drag) return
        const a = at.current
        a.px = Math.round(Math.min(a.most, Math.max(1, (axis === 'y' ? e.clientY : e.clientX) - a.from)))
        onSize(a.px)
      }}
      onPointerUp={() => {
        if (!drag) return
        setDrag(false)
        document.body.classList.remove('select-none', 'cursor-row-resize', 'cursor-col-resize')
        if (at.current.px) onDone(at.current.px)
      }}
      onDoubleClick={(e) => {
        if (onReset && !(e.target as Element).closest('button')) onReset()
      }}
      className={`group/line ${axis === 'y' ? 'cursor-row-resize' : 'cursor-col-resize'} ${place}`}
    >
      <span
        className={`pointer-events-none absolute bg-blue-500 opacity-0 transition-opacity group-hover/line:opacity-100 group-hover/line:delay-150 group-data-drag/line:opacity-100 ${axis === 'y' ? 'inset-x-0 top-1/2 h-0.5 -translate-y-1/2' : 'inset-y-0 left-1/2 w-0.5 -translate-x-1/2'}`}
      />
    </div>
  )
}
