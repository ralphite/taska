// What the side lists' stories share (Documents, Activity, Deleted): a project with a history, and the list's column
// with the pane beside it, as the page lays them.
import type { StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { activityRows } from '../model/activity'
import { Frames } from './Frames'
import { LOG, shopWithHistory } from './settingsFixtures'
import { goneRows } from '../features/side/goneRows'
import { SideFrame, type Side } from '../features/side/SideLists'

type Story = StoryObj

export const no = () => {}
export const m = shopWithHistory()
export const gone = goneRows(m)
/** The list's column and the pane beside it, as the page lays them. */
export const page = (side: Side, count: number, list: ReactNode, pane: ReactNode = null): Story => ({
  render: () => (
    <Frames phone={false} deskWidth={1100} height={560}>
      {() => (
        <div className="grid h-full grid-cols-[420px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
            <SideFrame side={side} count={count}>
              {list}
            </SideFrame>
          </div>
          <div className="min-h-0">{pane}</div>
        </div>
      )}
    </Frames>
  ),
})

export const logOn = { open: no, item: no, input: no, undo: no, more: no }
export const rows = activityRows(m, LOG)
export const inputGone = gone.find((x) => x.kind === 'input')
export const docGone = gone.find((x) => x.kind === 'doc')
