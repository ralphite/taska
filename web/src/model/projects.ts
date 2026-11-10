// The projects as the home page lists them: in your order (as dragged in the sidebar), the rest the latest first. And
// a project's card in the sidebar (F667): its counts, the agent last heard of, when it last changed.

import { agentLine, type AgentTone } from './agents'
import { ago } from './time'
import type { ProjectRow } from './types'

/** Where a project's picture is (F743): the address of the file it names; undefined for none (its letter). */
export const iconUrl = (slug: string, f: string | undefined): string | undefined => (f ? `/p/${encodeURIComponent(slug)}/f/${encodeURIComponent(f)}` : undefined)

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
  agent: { tone: AgentTone; label: string; who?: { by: string; state: string } } | null
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
    // a list's card: who and what it does, never its session (T711)
    agent: agent ? { tone: agent.tone, label: agent.label, ...(agent.who ? { who: { by: agent.who.by, state: agent.who.state } } : {}) } : null,
    changed: p.t && at ? ago(p.t, at, 'long') : '',
  }
}

/** The address a new project will get from its name, as the server makes it (domain/text.py slug_of, then -2, -3 while
 * taken); '' when the name has no a-z or 0-9 (the server then picks one by chance). */
export function newSlug(title: string, taken: readonly string[]): string {
  // eslint-disable-next-line no-control-regex
  const ascii = title.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase()
  const base = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')
  if (!base) return ''
  let slug = base
  for (let k = 2; taken.includes(slug); k++) slug = `${base.slice(0, 36).replace(/-+$/, '')}-${k}`
  return slug
}
