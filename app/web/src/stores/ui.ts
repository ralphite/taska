// What you are doing on the page that the address does not say: which parents are folded, which hidden subitems are
// shown, whether all of what needs you shows, the rows that hold still after you acted on them, the rows you picked,
// whether the sidebar is folded.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'

export interface Held {
  said: string
  /** the field and value it was changed to: once the item moves on (an agent took it further) the row shows it as it is */
  f?: string
  v?: unknown
  /** the row's height when it began holding, so its quiet line keeps it */
  height: number
}

export interface UiState {
  folded: ReadonlySet<number>
  subMore: ReadonlySet<number>
  needsAll: boolean
  held: ReadonlyMap<number, Held>
  /** the list's settings and open item when the rows began holding: anything else lets them go */
  heldFor: string
  selected: ReadonlySet<number>
  sideHidden: boolean
  /** the input you sent last from this page, for the line over the box */
  lastSent: { slug: string; rid: string } | null
  setLastSent(x: { slug: string; rid: string } | null): void
  toggleFold(n: number): void
  toggleSubMore(n: number): void
  toggleNeedsAll(): void
  hold(n: number, h: Held, forList: string): void
  release(): void
  dropHeld(n: number): void
  setSelected(s: ReadonlySet<number>): void
  setSideHidden(on: boolean): void
  /** a project is shown again as a fresh page shows it */
  reset(): void
}

export type UiStore = StoreApi<UiState>

const flip = <T,>(s: ReadonlySet<T>, x: T) => {
  const out = new Set(s)
  if (out.has(x)) out.delete(x)
  else out.add(x)
  return out
}

export function createUiStore(kv: KeyValueStore): UiStore {
  return createStore<UiState>()((set) => ({
    folded: new Set(),
    subMore: new Set(),
    needsAll: false,
    held: new Map(),
    heldFor: '',
    selected: new Set(),
    sideHidden: !!kv.get('taska.sideHidden'),
    lastSent: null,
    setLastSent: (lastSent) => set({ lastSent }),
    toggleFold: (n) => set((s) => ({ folded: flip(s.folded, n) })),
    toggleSubMore: (n) => set((s) => ({ subMore: flip(s.subMore, n) })),
    toggleNeedsAll: () => set((s) => ({ needsAll: !s.needsAll })),
    hold: (n, h, forList) =>
      set((s) => {
        const held = new Map(s.heldFor === forList ? s.held : [])
        if (!held.has(n)) held.set(n, h)
        else held.set(n, { ...h, height: (held.get(n) as Held).height })
        return { held, heldFor: forList }
      }),
    release: () => set((s) => (s.held.size ? { held: new Map(), heldFor: '' } : s)),
    dropHeld: (n) =>
      set((s) => {
        if (!s.held.has(n)) return s
        const held = new Map(s.held)
        held.delete(n)
        return { held }
      }),
    setSelected: (selected) => set({ selected }),
    setSideHidden: (on) => {
      kv.set('taska.sideHidden', on ? '1' : null)
      set({ sideHidden: on })
    },
    reset: () => set({ folded: new Set(), subMore: new Set(), needsAll: false, held: new Map(), heldFor: '', selected: new Set(), lastSent: null }),
  }))
}
