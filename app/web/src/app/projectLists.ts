// The projects as the page lists them: in your order, the one shown with this page's counts, the others as last
// listed; and the others to move something to.

import { useMemo } from 'react'
import { needsYou } from '../model/items'
import type { ProjectRow } from '../model/types'
import { openCount } from '../model/visible'
import { projectTones, toneOf } from '../ui/tones'
import { useStores, useStoreValue } from './context'
import { useProjectModel } from './hooks'

/** a project as the page lists it */
export interface ListedProject {
  slug: string
  title: string
  tone: string
  needs: number
  open: number | string
  /** the one shown */
  current: boolean
  href: string
}

type Shown = Omit<ProjectRow, 'open'> & { open: number | string }

const order = (a: Shown, b: Shown) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || (a.title || a.name).localeCompare(b.title || b.name)

/** The projects as the sidebar lists them: this one with this page's counts, the others as last listed. */
export function useSideProjects(slug: string): { list: ListedProject[] | null; tones: Map<string, string> } {
  const stores = useStores('data')
  const rows = useStoreValue(stores.data, (s) => s.projects)
  const m = useProjectModel(slug)
  return useMemo(() => {
    const tones = projectTones([slug, ...(rows || []).map((p) => p.name)])
    if (!rows && !slug) return { list: null, tones }
    const seen = (rows || []).find((p) => p.name === slug)
    const here: Shown | null = slug
      ? m
        ? { name: slug, title: m.facts.title, open: openCount(m.items), needs: m.items.filter(needsYou).length, pos: seen?.pos }
        : seen || { name: slug, title: '', open: '…', needs: 0 }
      : null
    const all: Shown[] = [...(here ? [here] : []), ...(rows || []).filter((p) => p.name !== slug)].sort(order)
    return {
      tones,
      list: all.map((p) => ({
        slug: p.name,
        title: p.title || p.name,
        tone: toneOf(tones, p.name),
        needs: p.needs,
        open: p.open,
        current: p.name === slug,
        href: `/p/${encodeURIComponent(p.name)}/`,
      })),
    }
  }, [rows, m, slug])
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
