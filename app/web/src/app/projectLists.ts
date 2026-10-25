// The projects as the page lists them: in your order, the one shown with this page's counts, the others as last
// listed; and the others to move something to.

import { useMemo } from 'react'
import { projectTones, toneOf } from '../ui/tones'
import { useStores, useStoreValue } from './context'
import { useProjectModel } from './hooks'
import { sideProjects, type ListedProject } from './sideProjects'

export type { ListedProject }

/** The projects as the sidebar lists them: this one with this page's counts, the others as last listed. */
export function useSideProjects(slug: string): { list: ListedProject[] | null; tones: Map<string, string> } {
  const stores = useStores('data')
  const rows = useStoreValue(stores.data, (s) => s.projects)
  const m = useProjectModel(slug)
  return useMemo(() => sideProjects(rows, m, slug), [rows, m, slug])
}

/** The other projects, to move something to: by name, with their colour and open count. */
export function useOtherProjects(slug: string): { slug: string; title: string; tone: string; open: number }[] {
  const stores = useStores('data')
  const rows = useStoreValue(stores.data, (s) => s.projects)
  return useMemo(() => {
    const tones = projectTones([slug, ...(rows || []).map((p) => p.name)])
    return (rows || []).filter((p) => p.name !== slug).map((p) => ({ slug: p.name, title: p.title || p.name, tone: toneOf(tones, p.name), open: p.open }))
  }, [rows, slug])
}
