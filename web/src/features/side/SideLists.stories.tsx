// Documents, Activity and Deleted beside the items on the desktop: the page's own lists in the list's column with their rows from the page's own listedDocs, activityRows and
// goneRows, and what is picked in Deleted in the pane beside it. On the phone they are Settings' pages (Settings).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { activityRows } from '../../model/activity'
import { listedDocs } from '../../model/docs'
import { Frames } from '../../stories/Frames'
import { LOG, shopWithHistory } from '../../stories/settingsFixtures'
import { goneRows } from './goneRows'
import { ActivityList, DeletedList, DeletedView, DocsList, SideFrame, type Side } from './SideLists'

export default { title: 'Components/Side lists' } satisfies Meta
type Story = StoryObj

const no = () => {}
const m = shopWithHistory()
const gone = goneRows(m)
/** The list's column and the pane beside it, as the page lays them. */
const page = (side: Side, count: number, list: ReactNode, pane: ReactNode = null): Story => ({
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

/** Every document, the newest first, each with its item and its comments; the one open beside the list lit. */
export const Documents: Story = { ...page('docs', m.docs.length, <DocsList docs={listedDocs(m)} open={1} onOpen={no} />), name: 'Documents' }
/** What happened, newest first, in words; your change has Undo; a line that opens what it changed. */
export const Activity: Story = { ...page('log', 0, <ActivityList rows={activityRows(m, LOG)} end picked={null} on={{ open: no, item: no, input: no, undo: no, more: no }} />), name: 'Activity' }
/** Everything deleted, the latest first: an item, what you said, a document. */
export const Deleted: Story = { ...page('deleted', gone.length, <DeletedList rows={gone} picked={null} on={{ show: no, restore: no }} />), name: 'Deleted' }
/** One picked: it shows in the pane, with Restore. */
export const DeletedPicked: Story = {
  ...page('deleted', gone.length, <DeletedList rows={gone} picked={gone[0].key} on={{ show: no, restore: no }} />, <DeletedView x={gone[0]} onRestore={no} />),
  name: 'Deleted, one picked',
}
// ---- more states (T639)
const logOn = { open: no, item: no, input: no, undo: no, more: no }
const rows = activityRows(m, LOG)
export const DocumentsNoneYet: Story = { ...page('docs', 0, <DocsList docs={[]} open={null} onOpen={no} />), name: 'Documents: none yet' }
export const ActivityLoading: Story = { ...page('log', 0, <ActivityList rows={null} end={false} picked={null} on={logOn} />), name: 'Activity: loading' }
export const ActivityNothingYet: Story = { ...page('log', 0, <ActivityList rows={[]} end picked={null} on={logOn} />), name: 'Activity: no changes yet' }
export const ActivityLoadingEarlier: Story = { ...page('log', 0, <ActivityList rows={rows} end={false} picked={null} on={logOn} />), name: 'Activity: earlier changes loading' }
export const ActivityOnePicked: Story = { ...page('log', 0, <ActivityList rows={rows} end picked={rows[1]?.s.key ?? null} on={logOn} />), name: 'Activity, one picked' }
/** the pointer on a row: its Undo (Activity) or Restore (Deleted) shows; hidden on the desktop until then */
export const PointerOnARow: Story = {
  ...page('deleted', gone.length, <DeletedList rows={gone} picked={null} on={{ show: no, restore: no }} />),
  name: 'Pointer on a row: Restore',
  parameters: { pseudo: { hover: ['li:first-of-type .group, li:first-of-type'] } },
}
export const DeletedNothing: Story = { ...page('deleted', 0, <DeletedList rows={[]} picked={null} on={{ show: no, restore: no }} />), name: 'Deleted: nothing' }
const inputGone = gone.find((x) => x.kind === 'input')
const docGone = gone.find((x) => x.kind === 'doc')
export const DeletedInputPicked: Story = { ...page('deleted', gone.length, <DeletedList rows={gone} picked={inputGone?.key ?? null} on={{ show: no, restore: no }} />, inputGone ? <DeletedView x={inputGone} onRestore={no} /> : null), name: 'Deleted, an input picked' }
export const DeletedDocumentPicked: Story = { ...page('deleted', gone.length, <DeletedList rows={gone} picked={docGone?.key ?? null} on={{ show: no, restore: no }} />, docGone ? <DeletedView x={docGone} onRestore={no} /> : null), name: 'Deleted, a document picked' }
