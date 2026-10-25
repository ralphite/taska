// The projects as the sidebar lists them, from what the page has: in your order, the one shown with this page's counts
// (its model), the others as last listed, each with its colour. Pure: the page and the stories both use it.

import { needsYou } from '../model/items'
import type { ProjectModel } from '../model/project'
import type { ProjectRow } from '../model/types'
import { openCount } from '../model/visible'
import { projectTones, toneOf } from '../ui/tones'

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

export function sideProjects(rows: readonly ProjectRow[] | null | undefined, m: ProjectModel | null | undefined, slug: string): { list: ListedProject[] | null; tones: Map<string, string> } {
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
}
