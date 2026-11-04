// What the side lists' stories share (Documents, Activity, Deleted): a project with a history, and the list's column
// with the pane beside it, as the page lays them.
import type { StoryObj } from '@storybook/react-vite'
import { useState, type ReactNode } from 'react'
import { activityRows } from '../model/activity'
import { Frames } from './Frames'
import { LOG, shopWithHistory } from './settingsFixtures'
import { goneRows } from '../features/side/goneRows'
import { ActivityList, DeletedList, DeletedView, SideFrame, type ActivityRow, type GoneRow, type Side } from '../features/side/SideLists'
import { acts } from './acts'

type Story = StoryObj

export const m = shopWithHistory()
export const gone = goneRows(m)
/** The list's column and the pane beside it, as the page lays them. */
function Columns({ side, count, list, pane }: { side: Side; count: number; list: ReactNode; pane: ReactNode }) {
  return (
    <div className="grid h-full grid-cols-[420px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <SideFrame side={side} count={count}>
          {list}
        </SideFrame>
      </div>
      <div className="min-h-0">{pane}</div>
    </div>
  )
}
export const page = (side: Side, count: number, list: ReactNode, pane: ReactNode = null): Story => ({
  render: () => <Frames phone={false} deskWidth={1100} height={560}>{() => <Columns side={side} count={count} list={list} pane={pane} />}</Frames>,
})

const sideActs = acts('Side list', ['open', 'item', 'input', 'undo', 'more', 'restore'] as const, { open: 'Item page' })

/** Activity as the page keeps it: a line picked (what it changed opens in the pane: the Actions panel), your change's
 * Undo asking again and then putting it back (Taska). */
function LiveActivity({ rows, end, picked: start, asking: asked }: { rows: ActivityRow[] | null; end: boolean; picked: string | null; asking: ReadonlySet<number> }) {
  const [picked, setPicked] = useState(start)
  const [asking, setAsking] = useState(asked)
  return (
    <ActivityList
      rows={rows}
      end={end}
      picked={picked}
      asking={asking}
      on={{ ...sideActs, open: (key) => (setPicked(key), sideActs.open(key)), undo: (seq) => (asking.has(seq) ? sideActs.undo(seq) : setAsking(new Set([...asking, seq]))) }}
    />
  )
}
export const activity = (o: { rows?: ActivityRow[] | null; end?: boolean; picked?: string | null; asking?: ReadonlySet<number> } = {}): Story =>
  page('log', 0, <LiveActivity rows={o.rows === undefined ? rows : o.rows} end={o.end ?? true} picked={o.picked ?? null} asking={o.asking ?? new Set()} />)

/** Deleted as the page keeps it: a row picked shows in the pane beside it (DeletedPickContainer); Restore needs Taska. */
function LiveDeleted({ list, picked: start }: { list: GoneRow[]; picked: string | null }) {
  const [picked, setPicked] = useState(start)
  const x = list.find((g) => g.key === picked)
  return <Columns side="deleted" count={list.length} list={<DeletedList rows={list} picked={picked} on={{ show: setPicked, restore: sideActs.restore }} />} pane={x ? <DeletedView x={x} onRestore={() => sideActs.restore(x.key)} /> : null} />
}
export const deleted = (picked: string | null, list: GoneRow[] = gone): Story => ({
  render: () => <Frames phone={false} deskWidth={1100} height={560}>{() => <LiveDeleted list={list} picked={picked} />}</Frames>,
})

export const rows = activityRows(m, LOG)
export const inputGone = gone.find((x) => x.kind === 'input')
export const docGone = gone.find((x) => x.kind === 'doc')
