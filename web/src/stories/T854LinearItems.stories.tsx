// T854 (D152, Yadong r1457-r1459): items closer to Linear's. A proposal composed only of the page's own parts (see
// t854/proto.tsx): # tags in place of types, groups with their progress, "waits for", and the agent session at the top
// of an item's page. Each story is the phone and the desktop side by side, and works as the page does: rows open,
// tags filter, the item's ⋯ menu opens (Tags…, Wait for…, Make a group), the agent's line opens the Agents sheet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { Proto, type Start } from './t854/proto'

export default { title: 'Prototype/T854 Linear-style items', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const story = (name: string, phone: Start, desk: Start = phone): Story => ({
  name,
  render: () => <Frames deskWidth={1280} height={960}>{(layout) => (layout === 'desk' ? <Proto desk start={desk} /> : <Proto desk={false} start={phone} />)}</Frames>,
})

/** The list: the group T840 with its icon, 3/5 and its bar; T845 and T846 wait for another; # tags beside the titles.
 * The desktop has T843 open: its agent at the top. */
export const List = story('List: group, waits for, tags', { open: null }, { open: 843 })
/** T843 open: the agent session on it at the top (its icon, name, dot, last line, how long ago); a tap opens the
 * Agents sheet on that session. Its tags in place of its type; "Blocks T845". */
export const AgentOnItem = story('Item: the agent on it', { open: 843 })
/** The same, the session waiting for Yadong: only its dot changes. */
export const AgentWaiting = story('Item: the agent waits on you', { open: 843, state: 'waiting' })
/** The group T840 open: Group in place of a status, its items under it with 3/5; Archive alone in its bar (it is never
 * done by itself). */
export const GroupOpen = story('Group open', { open: 840 })
/** T845 open: "Waits for T843". */
export const WaitsFor = story('Item: waits for another', { open: 845 })
/** A tag tapped: the list shows the items with #bug, the tag's chip over it (× takes it off). */
export const FilteredByTag = story('List: filtered by #bug', { open: null, tag: 'bug' }, { open: 843, tag: 'bug' })
