// What did not go in (T591: Menus and sheets > Sheets): the page's own rows (notSavedRows) and sheet, from the line
// over the box (Not saved · Details) on the desktop, a sheet on the phone: each can be sent again or let go.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { NotSaved } from '../../stores/feedback'
import { Frames } from '../../stories/Frames'
import { T } from '../../stories/fixtures'
import { AT_BUTTON, no, opened } from '../../stories/menuFixtures'
import { notSavedSheet } from './NotSaved'
import { notSavedRows } from './notSavedRows'

export default { title: 'Components/Menus and sheets/Sheets' } satisfies Meta
type Story = StoryObj

const at = (min: number) => Date.parse(T) - min * 60_000
const LIST: NotSaved[] = [
  { sid: 'a', what: 'F012 marked done', why: 'Taska said no: it was archived', at: at(28), slug: 'taska', go: '/p/taska/F012' },
  { sid: 'b', what: 'Reply to B003', why: 'Connection lost', at: at(32), slug: 'home', said: 'Keep the old filter', retry: no },
  { sid: 'c', what: 'Comment on D4', why: 'Connection lost', at: at(60 * 18), slug: 'taska', retry: no },
]
const sheet = (list: NotSaved[], desk: boolean) => opened(notSavedSheet(notSavedRows(list, 'taska', (s) => ({ home: 'Home' })[s] ?? s, Date.parse(T)), { go: no, retry: no, drop: no }) ?? { body: null }, desk, { look: desk ? { pop: true, at: AT_BUTTON } : {} })

export const List: Story = { name: 'Not saved', render: () => <Frames height={520} deskWidth={900} phoneWidth={393}>{(layout) => sheet(LIST, layout === 'desk')}</Frames> }
export const One: Story = { name: 'Not saved: one change', render: () => <Frames height={360} deskWidth={900} phoneWidth={393}>{(layout) => sheet(LIST.slice(1, 2), layout === 'desk')}</Frames> }
