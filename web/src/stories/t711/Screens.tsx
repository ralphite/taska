// T711 prototype: each place agents show, drawn by the page's own parts with a direction's piece put where it goes
// (Swap): the list (the pill in the head, the marks on the rows in progress), the Agents sheet, the item page, the
// sidebar card. Only for the stories.

import type { ReactNode } from 'react'
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
import { CardAgent, ItemAgent, Pill, RowMark, SheetBody, type Way } from './Directions'
import { B031, F012, NOW, SESSIONS, type Case } from './sessions'
import { Swap } from './Swap'

const at = (min: number) => new Date(NOW - min * 60e3).toISOString()
const QUEUE = 3

/** The project's items: two in progress (one per Claude Code session), three waiting for an agent, one proposed. */
const ITEMS: Item[] = [
  item({
    ...F012,
    status: 'doing',
    pri: 'P1',
    agent: { by: 'claude-code', t: T, ses: 'Export keeps the filter' },
    body: 'Export writes **all** rows; it should write only the rows the list shows.',
    thread: [
      message({ id: 1, by: 'you', kind: 'say', text: 'The export should keep the filter I set.', t: at(50) }),
      message({ id: 2, text: 'Testing with three filters', t: at(12) }),
    ],
  }),
  item({
    ...B031,
    type: 'bug',
    status: 'doing',
    agent: { by: 'claude-code', t: T, ses: 'Fix phone search' },
    thread: [message({ id: 3, text: 'Found it: words split on spaces only', t: at(1) })],
  }),
  item({ n: 5, pri: 'P1', title: 'Search finds words in the talk' }),
  item({ n: 6, title: 'Excel export as well' }),
  item({ n: 33, type: 'task', title: 'Rules: show each version’s date', code: 'T033' }),
  item({ n: 3, status: 'proposed', by: 'claude-code', title: 'Keep the filter in the export file name' }),
]

const mark = (n: number) => `article[data-n="${n}"] [aria-label$="is on it"]`

/** The list with its head: the pill in the head, each row in progress with its session's mark. */
function List({ way, c, desk }: { way: Way; c: Case; desk: boolean }) {
  const s = SESSIONS[c]
  const [exp, search] = s
  const list = listOf(ITEMS, 'items', {}, desk)
  const rows = (
    <Swap2 sel={mark(F012.n)} part={<RowMark way={way} x={exp} />}>
      <Swap2 sel={mark(B031.n)} part={<RowMark way={way} x={search} />}>
        {list}
      </Swap2>
    </Swap2>
  )
  return (
    <Swap sel='button[aria-label="Agents"]' how="inside" part={<Pill way={way} s={s} />}>
      <div className="flex h-full flex-col">
        {headOf(desk)}
        {desk ? <div className="h-full w-[420px] border-r border-zinc-200 dark:border-zinc-800">{rows}</div> : rows}
      </div>
    </Swap>
  )
}

const Swap2 = ({ sel, part, children }: { sel: string; part: ReactNode; children: ReactNode }) => (
  <Swap sel={sel} how="replace" part={part}>
    {children}
  </Swap>
)

export const listScreen = (way: Way, c: Case) => (
  <Frames phoneWidth={393} deskWidth={1000} height={420}>
    {(layout) => <List way={way} c={c} desk={layout === 'desk'} />}
  </Frames>
)

export const sheetScreen = (way: Way, c: Case) => (
  <Frames height={640} deskWidth={900}>
    {(layout) => (
      <Sheet open look={{ tall: true, wide: true }} desk={layout === 'desk'} onClose={act('Sheet: close')}>
        <SheetLayout title="Agents" body={<SheetBody way={way} s={SESSIONS[c]} queue={QUEUE} />} />
      </Sheet>
    )}
  </Frames>
)

export const itemScreen = (way: Way, c: Case) => (
  <Frames phoneWidth={393} deskWidth={900} height={560}>
    {(layout) => (
      <Swap sel='[data-part="item-times"]' how="after" part={<ItemAgent way={way} x={SESSIONS[c][0]} />}>
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
        <Swap sel="[data-card-agent]" how="replace" part={<CardAgent way={way} s={SESSIONS[c]} queue={QUEUE} />}>
          <ProjectCard title="Shop" tone={PROJECT_TONES[4]} card={CARD} />
        </Swap>
      </div>
    </Frame>
  </div>
)
