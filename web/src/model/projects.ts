// The projects as the home page lists them: in your order (as dragged in the sidebar), the rest the latest first. And
// a project's card in the sidebar (F667): its counts, the agent last heard of, when it last changed.

import { agentLine, agoLong, type AgentTone } from './agents'
import type { ProjectRow } from './types'

export const homeOrder = (rows: readonly ProjectRow[]): ProjectRow[] => [...rows].sort((a, b) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || (b.t || 0) - (a.t || 0))

/** What a project's card in the sidebar says. A count is null when the list kept from before does not have it yet. */
export interface ProjectCardFacts {
  open: number | string
  /** done or dropped */
  closed: number | null
  needs: number
  inputs: number | null
  docs: number | null
  /** the agent last heard of, as the project's bar says it (none: never one, and no work waits) */
  agent: { tone: AgentTone; label: string } | null
  /** when it last changed ("7 days ago"); '' when not known */
  changed: string
}

/** `at`: the time its times are told against. */
export function projectCard(p: Pick<ProjectRow, 'needs' | 'closed' | 'inputs' | 'docs' | 'agents' | 'work' | 't'> & { open: number | string }, at: number): ProjectCardFacts {
  const agent = p.agents?.length || p.work ? agentLine(p.agents, p.work, at) : null
  return {
    open: p.open,
    closed: p.closed ?? null,
    needs: p.needs,
    inputs: p.inputs ?? null,
    docs: p.docs ?? null,
    agent: agent ? { tone: agent.tone, label: agent.label } : null,
    changed: p.t && at ? agoLong(p.t, at) : '',
  }
}
