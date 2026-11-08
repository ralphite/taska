// T711: the project's coding-agent session blocked, waiting on Yadong. A proposal, composed only of the page's own
// parts with the demo project Shop: the phone's list page and the desktop's project page exactly as today, but for the
// one piece under discussion, the agent pill in the head; its click opens the page's own Agents sheet, where the
// active session's row is the other half of that piece. No state words and nothing about what the session waits on:
// the dot alone says it (amber blocked; at work as today). Two ways for the pill:
//   a. Pill: the pill as today, its label the agent's name alone, the amber dot
//   b. Icon: the agent's app icon alone, the dot on its corner
// Blocked first, then at work.
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { agentsSheet } from '../features/agents/Agents'
import { agentsFacts } from '../features/agents/agentsFacts'
import type { AgentSeen } from '../model/types'
import type { AgentInfo } from '../pages/Header'
import { Sheet, SheetLayout } from '../ui/Sheet'
import { Frames } from './Frames'
import { T } from './fixtures'
import { guide } from './guideFixture'
import { headOf } from './headFixtures'
import { PROJECT, listOf } from './listFixtures'
import { DeskPage } from './searchDeskPage'
import { SHOP } from './searchFixtures'
import { shopWithHistory } from './settingsFixtures'
import { act, acts } from './sheetFixtures'

export default { title: 'Prototype/T711 Agent sessions', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

type Way = 'a' | 'b'
type State = 'blocked' | 'working'

const now = Date.parse(T)
/** The project's one active session: a session works on many items, so its name is never an item's. */
const SESSION = 'Shop project work'
const at = { name: 'claude-code', t: now - 60_000, waiting: false, session: SESSION, sessions: [{ name: SESSION, t: now - 60_000 }] }
/** What Taska hears of the agent: at work, and blocked on Yadong (the server says what on; the proposal shows none of it). */
const AGENTS: Record<State, AgentSeen[]> = {
  working: [at],
  blocked: [{ ...at, blocked: [{ session: SESSION, waitingFor: 'approve Bash: npm --prefix web run check', since: now - 2 * 60_000 }] }],
}

/** What each way changes in the pill; its tip names the agent and the session alone. */
const TIP = `Claude Code · ${SESSION}`
const PILL: Record<Way, Record<State, Partial<AgentInfo>>> = {
  a: { blocked: { label: 'Claude Code', tip: TIP }, working: {} },
  b: { blocked: { by: 'claude-code', tip: TIP }, working: { by: 'claude-code' } },
}

const on = acts('Agents', ['copy', 'help'], { help: 'Help › Topics › Connect an agent' })

/** The page on the phone or the desktop; the agent pill opens the Agents sheet, as on the page. */
function Page({ way, state, desk }: { way: Way; state: State; desk: boolean }) {
  const [open, setOpen] = useState(false)
  const agents = AGENTS[state]
  const pill = PILL[way][state]
  const facts = { ...agentsFacts(shopWithHistory(agents), guide('shop')), dot: way === 'a' ? ('end' as const) : ('corner' as const) }
  return (
    <>
      {desk ? (
        <DeskPage slug="shop" n={1} rail={false} onSearch={act('Sidebar: search')} model={{ ...SHOP, facts: { ...SHOP.facts, agents } }} pill={pill} onAgents={() => setOpen(true)} />
      ) : (
        <div className="flex h-full flex-col">
          {headOf(false, { agents, pill, onAgents: () => setOpen(true) })}
          {listOf(PROJECT, 'items', {}, false)}
        </div>
      )}
      <Sheet open={open} look={{ tall: true, wide: true }} desk={desk} onClose={() => setOpen(false)}>
        {open ? <SheetLayout {...agentsSheet(facts, on)} /> : null}
      </Sheet>
    </>
  )
}

const story = (way: Way, state: State, name: string): Story => ({
  name,
  render: () => <Frames deskWidth={1280} height={760}>{(layout) => <Page way={way} state={state} desk={layout === 'desk'} />}</Frames>,
})

/** Blocked on Yadong: a. the pill says the agent's name with the amber dot; its row in Agents ends with the dot. */
export const BlockedPill = story('a', 'blocked', 'Blocked · a. Pill')
/** Blocked on Yadong: b. the agent's icon with the amber dot on its corner, in the pill and on its row in Agents. */
export const BlockedIcon = story('b', 'blocked', 'Blocked · b. Icon')
/** At work: a. the pill as today. */
export const WorkingPill = story('a', 'working', 'At work · a. Pill')
/** At work: b. the agent's icon with today's dot on its corner. */
export const WorkingIcon = story('b', 'working', 'At work · b. Icon')
