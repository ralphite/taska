// What floats over the page, one at a time: a sheet from the bottom on the phone (a dialog on the desktop), the
// card that floats above the box, a menu at a spot on the desktop. Its request says what it is about (a kind, with
// that kind's own fields); its place, how it shows. And the asks that a second click within 3 seconds confirms ("Delete F12?"), never a browser dialog.

import { createStore, type StoreApi } from 'zustand/vanilla'

export type Arm = 's' | 'p' | 't'

/** What a sheet is about: one kind each, with its own fields. Each feature draws its own kinds. */
export type SheetRequest =
  /** an item's actions (`arm`: opened on its status, priority or type menu) */
  | { kind: 'item-menu'; n: number; arm: Arm | null }
  | { kind: 'item-move-parent'; n: number }
  | { kind: 'item-move-project'; n: number }
  /** the inputs an item came from */
  | { kind: 'item-sources'; n: number }
  | { kind: 'message-menu'; n: number; id: number }
  | { kind: 'input-menu'; id: string }
  | { kind: 'input-history'; id: string }
  | { kind: 'input-move'; id: string }
  /** put an input with another item */
  | { kind: 'input-rescope'; id: string }
  /** a voice note's words as said */
  | { kind: 'as-said'; heard: string; tr: string }
  | { kind: 'filters' }
  | { kind: 'keys' }
  | { kind: 'switch-project' }
  | { kind: 'palette' }
  /** a document onto another item; a comment to another paragraph */
  | { kind: 'doc-move'; d: number }
  | { kind: 'comment-move'; d: number; id: number }

export type SheetKind = SheetRequest['kind']

/** How it shows. */
export interface SheetPlace {
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

export interface SheetSpec extends SheetPlace {
  req: SheetRequest
}

export interface SheetState {
  spec: SheetSpec | null
  /** what the field menus of the desktop's item menu show now (S, P, T) */
  arm: Arm | null
  /** the asks waiting for their second click, by key: when asked (ms) */
  asked: Readonly<Record<string, number>>
  open(spec: SheetSpec): void
  close(): void
  setArm(arm: Arm | null): void
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
