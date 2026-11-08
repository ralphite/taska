// T711 (r1186): how the page shows the project's agent session, redone after r1185's three were turned down ("the
// less text the better"; one active session per project, the old ones are not worth showing). A proposal, to decide
// on before anything is built: Gemini's two directions, each in every place (the pill in the project's bar, the rows,
// Who works here, the item page, the sidebar card), on the phone and the desktop, with the active session at work and
// blocked on Yadong. No state words and nothing about what it is blocked on (r1187): the dot alone says it (emerald
// pulsing at work, amber blocked). The agent is its app's icon (Claude Code, Codex), not a letter. Rows stay as today
// (the agent's icon on the row in progress, nothing more). Who works here: the active session, then "2 earlier"
// folded. The item page: nothing, or the agent's icon with the amber dot while the session is blocked. The page's own
// parts draw everything but the direction's piece; nothing here changes Taska itself.
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
        ['the list: the pill in the head; the rows as today', listScreen(way, c)],
        ['Who works here (the pill opens it)', sheetScreen(way, c)],
        ['the item page (F012)', itemScreen(c)],
        ['the sidebar card', cardScreen(way, c)],
      ]}
    />
  ),
})

/** a. Name. Pill: the icon, the session's name cut short, the dot. Who works here: the icon and the name, the dot at
 * the end; "2 earlier ›" folded. Card: the pill's mark, smaller. */
export const NameWorking = story('a', 'working', 'a. Name · at work')
export const NameWaiting = story('a', 'waiting', 'a. Name · blocked')

/** b. Badge. Pill: the icon alone, the dot on its corner. Who works here: the icon with its dot and the name;
 * "› 2 earlier" folded. Card: the icon with its dot. */
export const BadgeWorking = story('b', 'working', 'b. Badge · at work')
export const BadgeWaiting = story('b', 'waiting', 'b. Badge · blocked')
