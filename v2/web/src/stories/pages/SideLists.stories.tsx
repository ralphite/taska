// T521: Pages > Side lists: the lists the sidebar opens (documents, activity, deleted); T522: each with nothing in
// it, and Activity while it loads or fails (the real page, only Taska answers otherwise)
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Side lists', parameters: pageParams() }
export default meta

export const Documents: StoryObj = { ...screen(SHOP + 'docs'), name: 'Documents' }
export const Activity: StoryObj = { ...screen(SHOP + 'log'), name: 'Activity' }
export const Deleted: StoryObj = { ...screen(SHOP + 'deleted'), name: 'Deleted' }
/** T522: a project with no documents yet (Website). */
export const DocumentsNone: StoryObj = { ...screen('/p/website/docs'), name: 'Documents: none yet' }
/** T522: a project with almost no history (Website): one line, then "No earlier changes". */
export const ActivityAlmostNone: StoryObj = { ...screen('/p/website/log'), name: 'Activity: almost none' }
/** T522: a project where nothing was deleted (Website). */
export const DeletedNone: StoryObj = { ...screen('/p/website/deleted'), name: 'Deleted: nothing' }
/** T522: the change log not here yet: "Loading…". */
export const ActivityLoading: StoryObj = {
  ...screen(SHOP + 'log', undefined, { net: { '/api/log': 'hang' } }),
  name: 'Activity: loading',
}
/** T522: Taska refused the change log: the phone says so in a red toast and loads it once Taska is back; the
 * desktop's list stays at "Loading…" with no word. */
export const ActivityFailed: StoryObj = {
  ...screen(SHOP + 'log', undefined, { net: { '/api/log': 'down' } }),
  name: 'Activity: load failed',
}
