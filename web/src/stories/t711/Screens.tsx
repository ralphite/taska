// T711 prototype (r1186): each place the project's agent shows, drawn by the page's own parts with a direction's piece
// put where it goes (Swap): the list with its head (the pill; the rows as today), Who works here, the item page, the
// sidebar card. Only for the stories.

import { ProjectCard } from '../../features/sidebar/ProjectCard'
import type { Item } from '../../model/types'
import { PROJECT_TONES } from '../../ui/tones'
import { Frame, Frames } from '../Frames'
import { T, item, message } from '../fixtures'
import { headOf } from '../headFixtures'
import { pageOf } from '../itemPage'
import { listOf } from '../listFixtures'
import { act } from '../acts'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { AgentIcon, CardMark, Pill, SheetBody, type Way } from './Directions'
import { ACTIVE, F012, NOW, OLD, type Case } from './sessions'
import { Swap } from './Swap'

const at = (min: number) => new Date(NOW - min * 60e3).toISOString()

/** The project's items: F012 in progress (the active session's), three waiting for an agent, one proposed. */
const ITEMS: Item[] = [
  item({
    ...F012,
    status: 'doing',
    pri: 'P1',
    agent: { by: 'claude-code', t: T, ses: 'Shop project work' },
    body: 'Export writes **all** rows; it should write only the rows the list shows.',
    thread: [
      message({ id: 1, by: 'you', kind: 'say', text: 'The export should keep the filter I set.', t: at(50) }),
      message({ id: 2, text: 'Testing with three filters', t: at(12) }),
    ],
  }),
  item({ n: 5, pri: 'P1', title: 'Search finds words in the talk' }),
  item({ n: 6, title: 'Excel export as well' }),
  item({ n: 33, type: 'task', title: 'Checkout remembers the last address', code: 'T033' }),
  item({ n: 3, status: 'proposed', by: 'claude-code', title: 'Keep the filter in the export file name' }),
]

/** The list with its head: the direction's pill in the head; the rows as the page draws them, but the agent's icon
 * in place of the product's letter on the row in progress. */
function List({ way, c, desk }: { way: Way; c: Case; desk: boolean }) {
  const rows = listOf(ITEMS, 'items', {}, desk)
  return (
    <Swap sel='button[aria-label="Agents"]' how="inside" part={<Pill way={way} x={ACTIVE[c]} />}>
      <Swap sel='span[title$=" is on it"]' how="inside" part={<AgentIcon by={ACTIVE[c].agent} />}>
        <div className="flex h-full flex-col">
          {headOf(desk)}
          {desk ? <div className="h-full w-[420px] border-r border-zinc-200 dark:border-zinc-800">{rows}</div> : rows}
        </div>
      </Swap>
    </Swap>
  )
}

export const listScreen = (way: Way, c: Case) => (
  <Frames phoneWidth={393} deskWidth={1000} height={420}>
    {(layout) => <List way={way} c={c} desk={layout === 'desk'} />}
  </Frames>
)

export const sheetScreen = (way: Way, c: Case) => (
  <Frames height={520} deskWidth={900}>
    {(layout) => (
      <Sheet open look={{ tall: true, wide: true }} desk={layout === 'desk'} onClose={act('Sheet: close')}>
        <SheetLayout title="Agents" body={<SheetBody way={way} x={ACTIVE[c]} old={OLD} />} />
      </Sheet>
    )}
  </Frames>
)

/** The item page: as today; a session works on many items, so nothing about it shows here (r1198). */
export const itemScreen = () => (
  <Frames phoneWidth={393} deskWidth={900} height={420}>
    {(layout) => (
      // the agent's message in the talk shows the app's icon in place of the product's letter
      <Swap sel=".flex-wrap > span.size-5.rounded-md" how="replace" part={<AgentIcon by="claude-code" />}>
        {pageOf(ITEMS[0], layout === 'desk', { env: { now: NOW } })}
      </Swap>
    )}
  </Frames>
)

const CARD = { open: 13, closed: 42, needs: 3, inputs: 120, docs: 6, agent: { tone: 'idle' as const, label: '' }, changed: '2 min ago' }

export const cardScreen = (way: Way, c: Case) => (
  <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
    <Frame layout="desk" width={380} height={170} label="desktop only">
      <div className="p-6">
        <Swap sel="[data-card-agent]" how="replace" part={<CardMark way={way} x={ACTIVE[c]} />}>
          <ProjectCard title="Shop" tone={PROJECT_TONES[4]} card={CARD} />
        </Swap>
      </div>
    </Frame>
  </div>
)
