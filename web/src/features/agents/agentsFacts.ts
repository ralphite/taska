// What the Agents sheet shows, from the model: whether one is around, what waits for one, who was here and in which
// sessions, how to connect. Pure: the container and the stories both use it.

import { agentState, presenceOf } from '../../model/agents'
import { ago } from '../../model/time'
import { closed, waitsInQueue, withOpenKids } from '../../model/items'
import type { ProjectModel } from '../../model/project'
import type { AgentSeen } from '../../model/types'
import { AGENT_NAME, whoName } from '../../model/words'
import type { AgentsFacts } from './Agents'

/** An agent's sessions (those heard of today, as the server sends them, and any blocked on the user), those blocked on
 * the user first, then the latest first: each by its name, how long ago it was heard of, and what it waits on when it
 * waits on the user. */
function sessionsOf(a: AgentSeen, at: number): AgentsFacts['seen'][number]['sessions'] {
  const all = (a.sessions || []).filter((x) => x.name).map((x) => ({ name: x.name, t: x.t }))
  for (const b of a.blocked || []) if (!all.some((x) => x.name === b.session)) all.push({ name: b.session, t: b.since })
  return all
    .map((x) => {
      const b = a.blocked?.find((y) => y.session === x.name)
      return { t: x.t, name: x.name, when: ago(x.t, at, 'short'), blocked: !!b, waitingFor: b?.waitingFor || '' }
    })
    .sort((x, y) => Number(y.blocked) - Number(x.blocked) || y.t - x.t)
    .map(({ t: _t, ...s }) => s)
}

/** `guide` is the guide for agents, once it has come. */
export function agentsFacts(m: ProjectModel, guide: string | null): AgentsFacts {
  const live = m.items.filter((it) => !it.mergedInto && !it.archived)
  const kids = withOpenKids(m.items)
  const queue = live.filter((it) => waitsInQueue(it, kids)).length
  const [tone, , line] = agentState(m.facts.agents, m.facts.work, m.at, queue)
  const p = presenceOf(m.facts.agents, m.at)
  const base = m.facts.base
  const ask = `This project tracks work in Taska. Run \`curl -s ${base}/agent\` to learn the interface, then follow \`curl -s ${base}/next\` and write your progress back to the items.`
  return {
    tone,
    line,
    lineBy: p.k === 'none' ? undefined : p.a.name,
    queue,
    later: live.filter((it) => it.when === 'later' && !closed(it.status)).length,
    seen: [...m.facts.agents]
      .sort((a, b) => b.t - a.t)
      .map((a) => ({
        name: a.name,
        who: whoName(a.name),
        when: a.blocked?.length ? 'Blocked' : a.waiting ? 'waiting for work' : ago(a.t, m.at, 'long'),
        known: a.name in AGENT_NAME && a.name !== 'agent',
        sessions: sessionsOf(a, m.at),
      })),
    cmd: `curl -s ${base}/connect | sh`,
    far: m.facts.remote && m.facts.remote !== base ? `curl -s ${m.facts.remote}/connect | sh` : '',
    ask,
    guide,
  }
}
