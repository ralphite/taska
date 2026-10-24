// What floats over the page, one at a time: a sheet from the bottom on the phone (a dialog on the desktop), the
// card that floats above the box, a menu at a spot on the desktop. Its kind says what it holds; its props, about
// what. And the asks that a second click within 3 seconds confirms ("Delete F12?"), never a browser dialog.

import { createStore, type StoreApi } from 'zustand/vanilla'

export interface SheetSpec {
  kind: string
  props: Record<string, unknown>
  /** a menu at a spot on the desktop */
  pop?: boolean
  narrow?: boolean
  tall?: boolean
  /** the focus card, above the box */
  card?: boolean
  aboveComposer?: boolean
  /** its first button takes the focus */
  focus?: boolean
  /** where a desktop menu sits: at the pointer, or under the button it came from (its right edge on the button's) */
  at?: { x: number; y: number; right?: boolean; top?: number; left?: number } | null
}

export interface SheetState {
  spec: SheetSpec | null
  /** what the field menus of the desktop's item menu show now (S, P, T) */
  arm: 's' | 'p' | 't' | null
  /** the asks waiting for their second click, by key: when asked (ms) */
  asked: Readonly<Record<string, number>>
  open(spec: SheetSpec): void
  close(): void
  setArm(arm: 's' | 'p' | 't' | null): void
  ask(key: string, at: number): void
  forget(key: string, at?: number): void
}

export type SheetStore = StoreApi<SheetState>

export function createSheetStore(): SheetStore {
  return createStore<SheetState>()((set, get) => ({
    spec: null,
    arm: null,
    asked: {},
    open: (spec) => set({ spec }),
    close: () => set({ spec: null, arm: null }),
    setArm: (arm) => set({ arm }),
    ask: (key, at) => set((s) => ({ asked: { ...s.asked, [key]: at } })),
    forget: (key, at) => {
      if (at !== undefined && get().asked[key] !== at) return
      const asked = { ...get().asked }
      delete asked[key]
      set({ asked })
    },
  }))
}
