// Changes you made that the server does not have yet: each shows at once (its patches lie over the server's data),
// goes out in order, and is kept in this browser until the server has it, so a reload or a closed tab loses none.
// Kept per project in localStorage "taska.pending.<project>" as [{id, o, patches, t, p}] (the format pages have
// always kept them in).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Command } from '../api/taska'
import type { InputPatch, ItemPatch } from '../model/project'
import type { KeyValueStore } from './storage'

export interface PendingChange {
  id: string
  slug: string
  commands: Command[]
  patches: ItemPatch[]
  /** inputs shown changed meanwhile (an edit, details added); not kept over a reload */
  inputPatches?: InputPatch[]
  /** what it was, in a few words ("F12 marked done"), for the list of what is not saved */
  said: string
  t: number
  /** shown only: it adds nothing the server keeps (a stand-in until the server's own shows) */
  showOnly?: boolean
}

export interface ChangesState {
  list: PendingChange[]
  add(c: PendingChange): void
  remove(id: string): void
}

export type ChangesStore = StoreApi<ChangesState>

const KEY = 'taska.pending.'

interface Kept {
  id: string
  o: Command | Command[]
  patches: ItemPatch[]
  t: number
  p: string
}

export function createChangesStore(kv: KeyValueStore): ChangesStore {
  const keep = (slug: string, list: PendingChange[]) => {
    const mine: Kept[] = list
      .filter((c) => c.slug === slug && !c.showOnly)
      .map((c) => ({ id: c.id, o: c.commands.length === 1 ? c.commands[0] : c.commands, patches: c.patches.filter((x) => !x.add), t: c.t, p: `/p/${encodeURIComponent(slug)}/` })) // a stand-in item is not kept
    kv.setJson(KEY + slug, mine.length ? mine : null)
  }
  return createStore<ChangesState>()((set, get) => ({
    list: [],
    add: (c) => {
      set((s) => ({ list: [...s.list, c] }))
      keep(c.slug, get().list)
    },
    remove: (id) => {
      const gone = get().list.find((c) => c.id === id)
      if (!gone) return
      set((s) => ({ list: s.list.filter((c) => c.id !== id) }))
      keep(gone.slug, get().list)
    },
  }))
}

/** What was kept before a reload, in every project, oldest first. */
export function keptChanges(kv: KeyValueStore): PendingChange[] {
  const out: PendingChange[] = []
  for (const key of kv.keys()) {
    if (!key.startsWith(KEY)) continue
    const slug = key.slice(KEY.length)
    for (const k of kv.getJson<Kept[]>(key) || [])
      out.push({
        id: k.id,
        slug,
        commands: Array.isArray(k.o) ? k.o : [k.o],
        patches: k.patches || [],
        said: '',
        t: k.t || 0,
      })
  }
  return out.sort((a, b) => a.t - b.t)
}
