// T711 prototype: puts a direction's own part into a real component, where the page would draw it, without changing
// the component. Only for the stories.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Where the part goes, by the element `sel` finds in `children`: `inside` it (its own children hidden), in its
 * place (`replace`: it hidden), `after` it, or at its end (`append`). */
export type How = 'inside' | 'replace' | 'after' | 'append'

export function Swap({ sel, how, part, children }: { sel: string; how: How; part: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(sel)
    if (!el) return
    const h = document.createElement(how === 'inside' || how === 'replace' ? 'span' : 'div')
    h.className = 'contents'
    const hidden: HTMLElement[] = how === 'inside' ? ([...el.children] as HTMLElement[]) : how === 'replace' ? [el] : []
    hidden.forEach((x) => (x.hidden = true))
    if (how === 'inside' || how === 'append') el.append(h)
    else el.after(h)
    setHost(h)
    return () => {
      hidden.forEach((x) => (x.hidden = false))
      h.remove()
    }
  }, [sel, how])
  return (
    <div ref={ref} className="contents">
      {children}
      {host ? createPortal(part, host) : null}
    </div>
  )
}
