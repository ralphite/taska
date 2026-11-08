// T711 (r1185): how the page shows the agent sessions connected to a project, now that Taska knows each by its own id
// (its name, whether it works, idles or waits on you and on what, its item). A proposal, to decide on before anything
// is built: the three directions Gemini proposed, each in every place agents show (the pill in the project's bar, the
// rows in progress, the Agents sheet, the item page, the sidebar card), on the phone and the desktop, all at work and
// with one session blocked. The sessions: two Claude Code ("Export keeps the filter" on F012, "Fix phone search" on
// B031) and one Codex ("Rules versions", idle). The page's own parts draw everything but the direction's piece;
// nothing here changes Taska itself.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { States } from './Frames'
import type { Way } from './t711/Directions'
import { cardScreen, itemScreen, listScreen, sheetScreen } from './t711/Screens'
import type { Case } from './t711/sessions'

export default { title: 'Prototype/T711 Agent sessions', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const story = (way: Way, c: Case, name: string): Story => ({
  name,
  render: () => (
    <States
      items={[
        ['the list: the pill in the head, the marks on the rows in progress', listScreen(way, c)],
        ['the Agents sheet the pill opens', sheetScreen(way, c)],
        ['the item page (F012)', itemScreen(way, c)],
        ['the sidebar card', cardScreen(way, c)],
      ]}
    />
  ),
})

/** a. Calm context. Pill: "3 sessions"; blocked, the session's own name ("Export keeps the filter · blocked"). Rows:
 * the badge and the session's name; blocked, an amber "Blocked" instead. Sheet: one flat row per session (name; what it
 * does and since when; its item), the blocked one tinted. Item page: a quiet line, an amber box while blocked. Card: the
 * pill's words. */
export const CalmNormal = story('a', 'normal', 'a. Calm context · all at work')
export const CalmBlocked = story('a', 'blocked', 'a. Calm context · one blocked')

/** b. Session threads. Pill: counts ("3 sessions", "1 blocked"). Rows: the badge and the session's name at the row's
 * end, amber with a dot while blocked. Sheet: a card per session, its time at the right ("Working on B031", "Idle,
 * listening"; blocked: what it waits on and its item's code). Item page: a box with the session and what it does. Card:
 * "1 blocked · 3 in queue". */
export const ThreadsNormal = story('b', 'normal', 'b. Session threads · all at work')
export const ThreadsBlocked = story('b', 'blocked', 'b. Session threads · one blocked')

/** c. Session stacks. Pill: every session's badge stacked, then "working" or "1 blocked". Rows: a chip with the badge and
 * the session's name, amber with a dot while blocked. Sheet: a card per session (its time; what it does, a dot when it
 * waits on you; its item as a link). Item page: a box with the session, its time and what it does. Card: the stacked
 * badges and "1 blocked". */
export const StacksNormal = story('c', 'normal', 'c. Session stacks · all at work')
export const StacksBlocked = story('c', 'blocked', 'c. Session stacks · one blocked')
