// What you are doing on the page that the address does not say: which parents are folded, which hidden subtasks are
// shown, whether all of what needs you shows, the rows that hold still after you acted on them, the rows you picked,
// whether the sidebar is folded. The folded parents are kept in this browser for each project (T876), so a page opened
// again shows them as they were left.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'

export interface Held {
  said: string
  /** the field and value it was changed to: once the task moves on (an agent took it further) the row shows it as it is */
  f?: string
  v?: unknown
}

export interface UiState {
  folded: ReadonlySet<number>
  /** the project whose folded parents these are (kept under its name) */
  foldSlug: string
  subMore: ReadonlySet<number>
  held: ReadonlyMap<number, Held>
  /** the list's settings and open task when the rows began holding: anything else lets them go */
  heldFor: string
  selected: ReadonlySet<number>
  sideHidden: boolean
  /** the desktop's task pane in two columns: the task (or its document) on the left, its talk on the right */
  duo: boolean
  /** an input gone to (a search found it, a task's source, the activity log): lit where it is listed until it is
   * shown, then for a moment */
  lit: string | null
  /** lit where it is, the list not moved to it (the phone's way from the Sources sheet, as it always has been) */
  litStill: boolean
  /** the desktop's filters opened under the search (F) */
  deskFilters: boolean
  setDeskFilters(on: boolean): void
  /** the desktop list's views opened onto all their lines (T670; kept in this browser) */
  viewsOpen: boolean
  setViewsOpen(on: boolean): void
  /** long inputs opened whole (More) */
  openedInputs: ReadonlySet<string>
  toggleInput(id: string): void
  /** the input you sent last from this page, for the line over the box */
  lastSent: { slug: string; rid: string } | null
  /** what you sent, just taken in by Taska: in view where you are and lit up for a moment (an input's id) */
  setLastSent(x: { slug: string; rid: string } | null): void
  toggleFold(n: number): void
  unfold(n: number): void
  toggleSubMore(n: number): void
  hold(n: number, h: Held, forList: string): void
  release(): void
  dropHeld(n: number): void
  setSelected(s: ReadonlySet<number>): void
  setSideHidden(on: boolean): void
  setDuo(on: boolean): void
  setLit(id: string | null, still?: boolean): void
  /** the row of Activity or Deleted shown in the pane beside it */
  sideSel: string | null
  setSideSel(key: string | null): void
  /** a project is shown again as a fresh page shows it: its parents folded as this browser kept them */
  reset(slug?: string): void
}

export type UiStore = StoreApi<UiState>

const flip = <T,>(s: ReadonlySet<T>, x: T) => {
  const out = new Set(s)
  if (out.has(x)) out.delete(x)
  else out.add(x)
  return out
}

const foldKey = (slug: string) => `taska.folded.${slug}`

export function createUiStore(kv: KeyValueStore): UiStore {
  const keptFolds = (slug: string): ReadonlySet<number> => {
    const v = slug ? kv.getJson<unknown>(foldKey(slug)) : null
    return new Set(Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [])
  }
  const fold = (slug: string, folded: ReadonlySet<number>) => {
    if (slug) kv.setJson(foldKey(slug), folded.size ? [...folded] : null)
    return { folded }
  }
  return createStore<UiState>()((set) => ({
    folded: new Set(),
    foldSlug: '',
    subMore: new Set(),
    held: new Map(),
    heldFor: '',
    selected: new Set(),
    duo: false,
    lit: null,
    litStill: false,
    sideHidden: !!kv.get('taska.sideHidden'),
    sideSel: null,
    setSideSel: (sideSel) => set({ sideSel }),
    deskFilters: false,
    setDeskFilters: (deskFilters) => set({ deskFilters }),
    viewsOpen: !!kv.get('taska.viewsOpen'),
    setViewsOpen: (on) => {
      kv.set('taska.viewsOpen', on ? '1' : null)
      set({ viewsOpen: on })
    },
    openedInputs: new Set(),
    toggleInput: (id) => set((s) => ({ openedInputs: flip(s.openedInputs, id) })),
    lastSent: null,
    setLastSent: (lastSent) => set({ lastSent }),
    toggleFold: (n) => set((s) => fold(s.foldSlug, flip(s.folded, n))),
    unfold: (n) => set((s) => (s.folded.has(n) ? fold(s.foldSlug, flip(s.folded, n)) : s)),
    toggleSubMore: (n) => set((s) => ({ subMore: flip(s.subMore, n) })),
    hold: (n, h, forList) =>
      set((s) => {
        const held = new Map(s.heldFor === forList ? s.held : [])
        held.set(n, h)
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
    setLit: (lit, still = false) => set({ lit, litStill: !!lit && still }),
    setDuo: (duo) => set((s) => (s.duo === duo ? s : { duo })),
    setSideHidden: (on) => {
      kv.set('taska.sideHidden', on ? '1' : null)
      set({ sideHidden: on })
    },
    reset: (slug = '') => set({ folded: keptFolds(slug), foldSlug: slug, subMore: new Set(), held: new Map(), heldFor: '', selected: new Set(), lastSent: null, sideSel: null }),
  }))
}
