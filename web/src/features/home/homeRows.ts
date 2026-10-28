// The home page's rows: every project in the home page's order, each with its colour, its agent (the last one heard
// of, and whether it is around), its open count, what needs you and the first of it. Pure: the container and the
// stories both use it.

import { lastAgent } from '../../model/agents'
import { homeOrder } from '../../model/projects'
import type { Need, ProjectRow } from '../../model/types'
import { projectTones, toneOf } from '../../ui/tones'
import type { HomeRow } from './Home'

export function homeRows(projects: readonly ProjectRow[], needs: readonly Need[], at: number): HomeRow[] {
  const tones = projectTones(projects.map((p) => p.name))
  return homeOrder(projects).map((p) => {
    const top = needs.find((x) => x.project === p.name)
    return {
      name: p.name,
      title: p.title || p.name,
      tone: toneOf(tones, p.name),
      open: p.open,
      needs: p.needs,
      agent: lastAgent(p.agents, at),
      next: top ? { code: top.code, title: top.title } : null,
    }
  })
}
