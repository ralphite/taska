// The panes of the page (the list, the item pane, the foot, the sidebar), each registered by its element, and the
// one you acted in last: what floats over the page (the toast) shows over that pane.

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'

export type PaneName = 'list' | 'detail' | 'drawer' | 'inputs' | 'settings' | 'foot' | 'drawerFoot' | 'sheetFoot'

export class Panes {
  private els = new Map<PaneName, HTMLElement>()
  private told = new Set<() => void>()
  last: PaneName | null = null

  /** You act in another pane: what floats over the page goes over it. -> how to stop */
  onLast(fn: () => void): () => void {
    this.told.add(fn)
    return () => this.told.delete(fn)
  }

  /** The pane a pointer went down in becomes the last one. */
  down(target: EventTarget | null): void {
    const to = this.of(target) ?? this.last
    if (to === this.last) return
    this.last = to
    for (const fn of this.told) fn()
  }

  set(name: PaneName, el: HTMLElement | null): void {
    if (el) this.els.set(name, el)
    else this.els.delete(name)
  }

  get(name: PaneName): HTMLElement | null {
    const el = this.els.get(name)
    return el && el.isConnected && el.offsetParent ? el : null
  }

  /** The pane a pointer went down in, if any. */
  of(target: EventTarget | null): PaneName | null {
    for (const [name, el] of this.els) if (target instanceof Node && el.contains(target)) return name
    return null
  }
}

const PanesContext = createContext<Panes | null>(null)

export function PanesProvider({ children }: { children: ReactNode }) {
  const panes = useMemo(() => new Panes(), [])
  useEffect(() => {
    const down = (e: PointerEvent) => panes.down(e.target)
    document.addEventListener('pointerdown', down, true)
    return () => document.removeEventListener('pointerdown', down, true)
  }, [panes])
  return <PanesContext.Provider value={panes}>{children}</PanesContext.Provider>
}

export function usePanes(): Panes | null {
  return useContext(PanesContext)
}

/** A ref callback that registers an element as a pane. */
export function usePaneRef(name: PaneName): (el: HTMLElement | null) => void {
  const panes = usePanes()
  return useCallback((el: HTMLElement | null) => panes?.set(name, el), [panes, name])
}
