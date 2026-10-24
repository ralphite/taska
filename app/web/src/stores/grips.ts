// How wide you dragged the sidebar and the list, how tall the item over its talk, and how wide the item beside its
// talk (0: as the page has them), kept in this browser ("taska.w.<side|list|top|duo>", as pages have always kept them).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'

export type GripKind = 'side' | 'list' | 'top' | 'duo'

export interface GripsState {
  px: Readonly<Record<GripKind, number>>
  /** while dragging (not kept yet) */
  size(kind: GripKind, px: number): void
  /** kept; 0: back to the page's own */
  keep(kind: GripKind, px: number): void
}

export type GripsStore = StoreApi<GripsState>

const KINDS: GripKind[] = ['side', 'list', 'top', 'duo']

export function createGripsStore(kv: KeyValueStore): GripsStore {
  const px = Object.fromEntries(KINDS.map((k) => [k, Number(kv.get('taska.w.' + k)) || 0])) as Record<GripKind, number>
  return createStore<GripsState>()((set) => ({
    px,
    size: (kind, n) => set((s) => ({ px: { ...s.px, [kind]: n } })),
    keep: (kind, n) => {
      kv.set('taska.w.' + kind, n ? String(n) : null)
      set((s) => ({ px: { ...s.px, [kind]: n } }))
    },
  }))
}

/** The sizes as the page's CSS variables. */
export function gripVars(px: Readonly<Record<GripKind, number>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of KINDS) if (px[k]) out[`--${k}-${k === 'top' ? 'h' : 'w'}`] = px[k] + 'px'
  return out
}
