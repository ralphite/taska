// The projects as the sidebar lists them, from what the page has: in your order, the one shown with this page's counts
// (its model), the others as last listed, each with its colour and its card (F667). Pure: the page and the stories
// both use it.

import { closed } from '../model/items'
import { needsYou } from '../model/needStates'
import { needsCount } from '../model/rules'
import type { ProjectModel } from '../model/project'
import { iconUrl, projectCard, type ProjectCardFacts } from '../model/projects'
import type { ProjectRow } from '../model/types'
import { inTab, openCount } from '../model/visible'
import { projectTones, toneOf } from '../ui/tones'

/** a project as the page lists it */
export interface ListedProject {
  slug: string
  title: string
  tone: string
  /** its picture's address (F743); none: its letter */
  icon?: string
  needs: number
  open: number | string
  /** the one shown */
  current: boolean
  href: string
  /** what its card under the pointer says */
  card: ProjectCardFacts
}

type Shown = Omit<ProjectRow, 'open'> & { open: number | string }

const order = (a: Shown, b: Shown) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || (a.title || a.name).localeCompare(b.title || b.name)

/** The projects' pictures' addresses (F743), by address: the one shown as this page has it, the others as listed. */
export function projectIcons(rows: readonly ProjectRow[] | null | undefined, m: ProjectModel | null | undefined, slug: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const p of rows || []) {
    const url = iconUrl(p.name, p.name === slug && m ? m.facts.icon : p.icon)
    if (url) out.set(p.name, url)
  }
  const here = slug && m ? iconUrl(slug, m.facts.icon) : undefined
  if (here) out.set(slug, here)
  return out
}

/** `at`: when the projects were last listed (what their times are told against). */
export function sideProjects(rows: readonly ProjectRow[] | null | undefined, m: ProjectModel | null | undefined, slug: string, at = 0): { list: ListedProject[] | null; tones: Map<string, string>; icons: Map<string, string> } {
  const tones = projectTones([slug, ...(rows || []).map((p) => p.name)])
  const icons = projectIcons(rows, m, slug)
  if (!rows && !slug) return { list: null, tones, icons }
  const seen = (rows || []).find((p) => p.name === slug)
  const here: Shown | null = slug
    ? m
      ? {
          ...seen,
          name: slug,
          title: m.facts.title,
          open: openCount(m.items),
          needs: needsCount(m, needsYou),
          closed: m.items.filter((it) => !it.mergedInto && inTab(it, 'items') && closed(it.status)).length,
          inputs: m.inputs.length,
          docs: m.docs.filter((d) => d.kind !== 'rules').length,
          agents: m.facts.agents,
          work: m.facts.work,
        }
      : seen || { name: slug, title: '', open: '…', needs: 0 }
    : null
  const all: Shown[] = [...(here ? [here] : []), ...(rows || []).filter((p) => p.name !== slug)].sort(order)
  return {
    tones,
    icons,
    list: all.map((p) => ({
      slug: p.name,
      title: p.title || p.name,
      tone: toneOf(tones, p.name),
      icon: icons.get(p.name),
      needs: p.needs,
      open: p.open,
      current: p.name === slug,
      href: `/p/${encodeURIComponent(p.name)}/`,
      card: projectCard(p, p.name === slug && m ? Math.max(at, m.at) : at),
    })),
  }
}
