// What Settings' sections show, from the model and what the page has: Agents (whether one is around, what waits for
// one, who was here, how to connect), Projects (this one with this page's counts), Documents, Activity and Deleted.
// Pure: the container and the stories both use it.

import type { ListedProject } from '../../app/sideProjects'
import { logSentence } from '../../model/activity'
import { agentState, agoLong } from '../../model/agents'
import { closed, inQueue } from '../../model/items'
import { listedCommentCount } from '../../model/docs'
import { codeOf, liveN, type ProjectModel } from '../../model/project'
import { dayShort, when } from '../../model/time'
import type { LogRow, ProjectRow } from '../../model/types'
import type { DeletedProject } from '../../stores/settings'
import { AGENT_NAME, inputCode, plural, whoName } from '../../model/words'
import type { GoneInputRow, GoneThingRow, PhoneDocRow } from './PhoneSections'
import type { AgentsFacts, ProjectsFacts } from './Sections'
import type { NavFacts } from './SettingsNav'

/** Agents: `guide` is the guide for agents, once it has come. */
export function agentsFacts(m: ProjectModel, guide: string | null): AgentsFacts {
  const [tone, , line] = agentState(m.facts.agents, m.facts.work, m.at)
  const live = m.items.filter((it) => !it.mergedInto && !it.archived && it.type !== 'rule')
  const base = m.facts.base
  const ask = `This project tracks work in Taska. Run \`curl -s ${base}/agent\` to learn the interface, then follow \`curl -s ${base}/next\` and write your progress back to the items.`
  return {
    tone,
    line,
    queue: live.filter((it) => inQueue(it) && it.status !== 'doing' && it.when === 'now').length,
    later: live.filter((it) => it.when === 'later' && !closed(it.status)).length,
    seen: [...m.facts.agents].sort((a, b) => b.t - a.t).map((a) => ({ name: a.name, who: whoName(a.name), when: a.waiting ? 'waiting for work' : agoLong(a.t, m.at), known: a.name in AGENT_NAME && a.name !== 'agent' })),
    cmd: `curl -s ${base}/connect | sh`,
    far: m.facts.remote && m.facts.remote !== base ? `curl -s ${m.facts.remote}/connect | sh` : '',
    ask,
    guide,
  }
}

/** Projects: every project (this one with this page's counts), the deleted ones, and the section's state. */
export function projectsOf(
  projects: readonly ProjectRow[] | null | undefined,
  side: readonly ListedProject[] | null,
  st: { deleted: readonly DeletedProject[] | null; pNew: boolean; pNewText: string; pErr: string; renaming: string | null; pMenu: string | null },
  asked: Readonly<Record<string, number>>,
  file: string,
): ProjectsFacts {
  return {
    live: projects && side ? side.map((p) => ({ name: p.slug, title: p.title, tone: p.tone, open: typeof p.open === 'number' ? p.open : 0, here: p.current })) : null,
    gone: (st.deleted || []).map((d) => ({ name: d.name, title: d.title, when: dayShort(d.t), items: d.items })),
    file,
    pNew: st.pNew,
    pNewText: st.pNewText,
    pErr: st.pErr,
    renaming: st.renaming,
    purging: new Set(Object.keys(asked).filter((k) => k.startsWith('purge ')).map((k) => k.slice(6))),
    menu: st.pMenu,
  }
}

/** Documents, newest first, each with its item. */
export const docRows = (m: ProjectModel): PhoneDocRow[] =>
  [...m.docs]
    .sort((a, b) => b.d - a.d)
    .map((d) => {
      const it = m.byN.get(liveN(m, d.n))
      return { d: d.d, title: d.title, web: d.fmt === 'html', on: it ? `${codeOf(m, it.n)} ${it.title}` : '', comments: listedCommentCount(d) }
    })

/** Activity: each change in words, and whether it can be undone. */
export const logRows = (m: ProjectModel, rows: readonly LogRow[]) => rows.map((e) => ({ s: logSentence(m, e), undo: m.facts.undo.find((u) => u.seq === e.seq)?.seq ?? null }))

/** Deleted: the items and documents, and what you said. */
export const deletedRows = (m: ProjectModel): { things: GoneThingRow[]; inputs: GoneInputRow[] } => ({
  things: m.facts.deleted.map((x) => ({
    label: x.kind === 'item' ? x.code || '' : `D${x.d}`,
    title: x.title,
    what: x.kind === 'item' ? `Item${x.more ? `, with ${plural(x.more, 'subitem')}` : ''}` : `Document${x.on ? ` on ${x.on}` : ''}`,
    at: when(x.at, m.at),
  })),
  inputs: m.facts.deletedInputs.map((x) => ({ id: x.id, code: inputCode(x.id), t: when(x.t, m.at), at: when(x.at, m.at), text: x.text || (x.files ? plural(x.files, 'file') : ''), items: x.items })),
})


/** The way through Settings: the project, whether an agent is around, and what each section's row says on its right
 * (`said`: what the page knows of notifications, projects and spellings). */
export function navFacts(m: ProjectModel | null, title: string, tone: string, said: { notifications: string; projects: number | ''; spellings: number | '' }): NavFacts {
  const agent = m ? agentState(m.facts.agents, m.facts.work, m.at) : null
  return {
    title,
    tone,
    agentTone: agent ? agent[0] : 'idle',
    right: { notifications: said.notifications, agents: agent ? agent[1] : '', projects: said.projects, spellings: said.spellings, organizer: m?.facts.organizer.on ? 'On' : 'Off' },
  }
}
