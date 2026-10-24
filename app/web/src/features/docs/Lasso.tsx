// Drawing around the part of a document to comment on: the paragraphs the loop goes around are picked. Props only.

import { useLayoutEffect, useRef } from 'react'

export function Lasso({ onDrawn }: { onDrawn(keys: string[]): void }) {
  const ref = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const done = useRef(onDrawn)
  useLayoutEffect(() => {
    done.current = onDrawn
  })
  useLayoutEffect(() => {
    const svg = ref.current
    const path = pathRef.current
    if (!svg || !path) return
    const pts: [number, number][] = []
    const add = (e: PointerEvent) => {
      const b = svg.getBoundingClientRect()
      pts.push([e.clientX - b.left, e.clientY - b.top])
      path.setAttribute('d', 'M' + pts.map((p) => p.join(' ')).join(' L') + (pts.length > 2 ? ' Z' : ''))
    }
    const down = (e: PointerEvent) => {
      pts.length = 0
      add(e)
      try {
        svg.setPointerCapture(e.pointerId)
      } catch {
        /* no capture */
      }
    }
    const move = (e: PointerEvent) => {
      if (pts.length) add(e)
    }
    const up = () => {
      const box = svg.getBoundingClientRect()
      const poly = pts.map(([x, y]) => [x + box.left, y + box.top] as const)
      const inside = (x: number, y: number) =>
        poly.reduce((c, [xi, yi], i) => {
          const [xj, yj] = poly[(i + poly.length - 1) % poly.length]
          return yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi ? !c : c
        }, false)
      const ys = poly.map((p) => p[1])
      // the paragraphs of the text it is drawn over
      const picked = [...(svg.parentElement?.querySelectorAll<HTMLElement>(':scope > section[data-key]') || [])]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          const cy = (r.top + r.bottom) / 2
          return inside((r.left + r.right) / 2, cy) || inside(r.left + 24, cy) || (cy > Math.min(...ys) && cy < Math.max(...ys) && pts.length > 8)
        })
        .map((el) => el.dataset.key as string)
      done.current(picked)
    }
    svg.addEventListener('pointerdown', down)
    svg.addEventListener('pointermove', move)
    svg.addEventListener('pointerup', up)
    return () => {
      svg.removeEventListener('pointerdown', down)
      svg.removeEventListener('pointermove', move)
      svg.removeEventListener('pointerup', up)
    }
  }, [])
  return (
    <svg ref={ref} className="absolute inset-0 z-10 h-full w-full touch-none" aria-label="Draw around the part to comment on">
      <path ref={pathRef} d="" fill="rgba(251,191,36,.15)" stroke="rgb(245,158,11)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
