// The open document as you have it: which comment threads are open, what you picked to comment on (paragraphs, words
// in one, a thread to reply in), whether you circle an area or point at a web page's parts, the editor and its text,
// and where each document was scrolled to. Another document starts afresh.

import { createStore, type StoreApi } from 'zustand/vanilla'

export interface DocViewState {
  d: number | null
  /** the threads shown open: "key#th", a paragraph's key (all its threads), "doc" (the whole document's) */
  threads: ReadonlySet<string>
  /** paragraphs picked (by circling, or a tap on the phone) */
  sel: ReadonlySet<string>
  /** words picked inside one paragraph (a list's item, a selection) */
  quote: { key: string; text: string } | null
  /** the thread a reply goes to */
  reply: string | null
  /** drawing around an area to comment on it */
  circle: boolean
  /** a web page's Comment mode */
  inspect: boolean
  /** the phone's box is shown to type a comment */
  typing: boolean
  /** the editor is open, with this text (null: the document's own) */
  editing: boolean
  text: string | null
  /** a new document's item, while its editor is open */
  newFor: number | null
  scroll: Readonly<Record<number, number>>
  show(d: number | null): void
  toggleThread(tk: string): void
  closeThreads(...tks: string[]): void
  openThread(tk: string): void
  pick(p: { sel?: ReadonlySet<string>; quote?: { key: string; text: string } | null; reply?: string | null }): void
  unpick(): void
  setCircle(on: boolean): void
  setInspect(on: boolean): void
  setTyping(on: boolean): void
  edit(on: boolean, text?: string | null, newFor?: number | null): void
  setText(text: string): void
  keepScroll(d: number, top: number): void
}

export type DocViewStore = StoreApi<DocViewState>

const fresh = { threads: new Set<string>(), sel: new Set<string>(), quote: null, reply: null, circle: false, typing: false, editing: false, text: null, newFor: null }

export function createDocViewStore(): DocViewStore {
  return createStore<DocViewState>()((set, get) => ({
    d: null,
    ...fresh,
    inspect: false,
    scroll: {},
    show: (d) => {
      if (d === get().d) return
      set({ d, ...fresh, inspect: false })
    },
    toggleThread: (tk) =>
      set((s) => {
        const threads = new Set(s.threads)
        if (threads.has(tk)) threads.delete(tk)
        else threads.add(tk)
        return { threads }
      }),
    openThread: (tk) => set((s) => (s.threads.has(tk) ? s : { threads: new Set([...s.threads, tk]) })),
    closeThreads: (...tks) => set((s) => ({ threads: new Set([...s.threads].filter((t) => !tks.includes(t))) })),
    pick: (p) => set((s) => ({ sel: p.sel ?? s.sel, quote: p.quote !== undefined ? p.quote : s.quote, reply: p.reply !== undefined ? p.reply : s.reply })),
    unpick: () => set({ sel: new Set(), quote: null, reply: null, circle: false }),
    setCircle: (circle) => set({ circle, ...(circle ? { quote: null } : {}) }),
    setInspect: (inspect) => set({ inspect }),
    setTyping: (typing) => set({ typing }),
    edit: (editing, text = null, newFor = null) => set({ editing, text: editing ? text : null, newFor: editing ? newFor : null }),
    setText: (text) => set({ text }),
    keepScroll: (d, top) => set((s) => ({ scroll: { ...s.scroll, [d]: top } })),
  }))
}
