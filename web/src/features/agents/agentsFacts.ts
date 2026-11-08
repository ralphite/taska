// What the Agents sheet shows, from the model: whether one is around, what waits for one, who was here, how to
// connect. Pure: the container and the stories both use it.

import { agentState, agoLong } from '../../model/agents'
import { closed, waitsInQueue, withOpenKids } from '../../model/items'
import type { ProjectModel } from '../../model/project'
import { AGENT_NAME, whoName } from '../../model/words'
import type { AgentsFacts } from './Agents'

/** `guide` is the guide for agents, once it has come. */
export function agentsFacts(m: ProjectModel, guide: string | null): AgentsFacts {
  const live = m.items.filter((it) => !it.mergedInto && !it.archived)
  const kids = withOpenKids(m.items)
  const queue = live.filter((it) => waitsInQueue(it, kids)).length
  const [tone, , line] = agentState(m.facts.agents, m.facts.work, m.at, queue)
  const base = m.facts.base
  const ask = `This project tracks work in Taska. Run \`curl -s ${base}/agent\` to learn the interface, then follow \`curl -s ${base}/next\` and write your progress back to the items.`
  return {
    tone,
    line,
    queue,
    later: live.filter((it) => it.when === 'later' && !closed(it.status)).length,
    seen: [...m.facts.agents]
      .sort((a, b) => b.t - a.t)
      .map((a) => ({
        name: a.name,
        who: whoName(a.name),
        when: a.blocked?.length ? 'Blocked' : a.waiting ? 'waiting for work' : agoLong(a.t, m.at),
        known: a.name in AGENT_NAME && a.name !== 'agent',
        blocked: (a.blocked || []).map((b) => ({ session: b.session, waitingFor: b.waitingFor })),
      })),
    cmd: `curl -s ${base}/connect | sh`,
    far: m.facts.remote && m.facts.remote !== base ? `curl -s ${m.facts.remote}/connect | sh` : '',
    ask,
    guide,
  }
}
