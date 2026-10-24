// The server's data as the page has it: each project's copy (kept up to date by sync/projectSync), how sure the page
// is that the server is away, and the projects' list with what needs you in each (the sidebar, the home page).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ServerCopy } from '../model/project'
import type { Need, ProjectRow } from '../model/types'

export interface DataState {
  copies: Record<string, ServerCopy>
  /** per project: 0 while the server answers; 2 and more: it is away (the page says so) */
  away: Record<string, number>
  /** the projects as last listed (null: never listed in this browser) */
  projects: ProjectRow[] | null
  /** what needs you, every project's, the most pressing first (as last listed) */
  needs: Need[]
  /** when the projects were last listed (what "an agent is around" is measured against) */
  listedAt: number
  /** the list could not be asked lately: the one shown is the one kept from before */
  listAway: boolean
  /** each project's pictures' sizes, by file */
  sizes: Readonly<Record<string, Readonly<Record<string, readonly [number, number]>>>>
  setSizes(slug: string, sizes: Record<string, [number, number]>): void
  setCopy(slug: string, copy: ServerCopy): void
  setAway(slug: string, away: number): void
  setProjects(rows: ProjectRow[], needs: Need[] | null, at: number): void
  setListAway(away: boolean): void
}

export type DataStore = StoreApi<DataState>

export function createDataStore(projects: ProjectRow[] | null = null, needs: Need[] = [], at = 0): DataStore {
  return createStore<DataState>()((set) => ({
    copies: {},
    away: {},
    projects,
    needs,
    listedAt: at,
    listAway: false,
    sizes: {},
    setSizes: (slug, sizes) => set((s) => ({ sizes: { ...s.sizes, [slug]: { ...s.sizes[slug], ...sizes } } })),
    setCopy: (slug, copy) => set((s) => ({ copies: { ...s.copies, [slug]: copy } })),
    setAway: (slug, away) => set((s) => (s.away[slug] === away ? s : { away: { ...s.away, [slug]: away } })),
    setProjects: (rows, needs, at) => set((s) => ({ projects: rows, needs: needs ?? s.needs, listedAt: at, listAway: false })),
    setListAway: (away) => set((s) => (s.listAway === away ? s : { listAway: away })),
  }))
}
