// The server's data as the page has it: each project's copy (kept up to date by sync/projectSync), how sure the page
// is that the server is away, and the projects' list (the sidebar, the home page).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ServerCopy } from '../model/project'
import type { ProjectRow } from '../model/types'

export interface DataState {
  copies: Record<string, ServerCopy>
  /** per project: 0 while the server answers; 2 and more: it is away (the page says so) */
  away: Record<string, number>
  /** the projects as last listed (null: never listed in this browser) */
  projects: ProjectRow[] | null
  setCopy(slug: string, copy: ServerCopy): void
  setAway(slug: string, away: number): void
  setProjects(rows: ProjectRow[]): void
}

export type DataStore = StoreApi<DataState>

export function createDataStore(projects: ProjectRow[] | null = null): DataStore {
  return createStore<DataState>()((set) => ({
    copies: {},
    away: {},
    projects,
    setCopy: (slug, copy) => set((s) => ({ copies: { ...s.copies, [slug]: copy } })),
    setAway: (slug, away) => set((s) => (s.away[slug] === away ? s : { away: { ...s.away, [slug]: away } })),
    setProjects: (rows) => set({ projects: rows }),
  }))
}
