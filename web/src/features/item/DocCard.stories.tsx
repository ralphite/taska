import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { T } from '../../stories/fixtures'
import { comment, doc } from '../../stories/itemFixtures'
import { DocCard } from './DocCard'
import { act } from '../../stories/acts'

const meta: Meta = { title: 'UI/Item pane/Documents on it' }
export default meta
type Story = StoryObj

const now = Date.parse(T) + 60_000
const card = (d: Parameters<typeof DocCard>[0]['d'], waiting = '') => (
  <div className="p-3">
    <DocCard d={d} now={now} waiting={waiting} onOpen={act('Document card: open → Document › Reading')} />
  </div>
)

const one = (d: Parameters<typeof DocCard>[0]['d'], waiting = ''): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={560}>{() => card(d, waiting)}</Frames> })

export const NoComments: Story = { ...one(doc({ d: 1, n: 12 })), name: 'No comments' }
export const TwoComments: Story = { ...one(doc({ d: 2, n: 12, blocks: [{ key: 'k1', kind: 'para', text: 'x', comments: [comment({ id: 1 }), comment({ id: 2, by: 'codex' })] }] })), name: 'Two comments' }
export const AWebPage: Story = { ...one(doc({ d: 3, n: 12, fmt: 'html', title: 'Mock-up of the export dialog' })), name: 'A web page' }
export const ChoicesNotSent: Story = { ...one(doc({ d: 4, n: 12 }), '2 choices not sent'), name: 'Choices not sent' }
export const ALongTitle: Story = { ...one(doc({ d: 5, n: 12, title: 'Test every part of the web page documents and fix what breaks: comments, picking, screenshots and export, on the phone and the desktop' })), name: 'A long title' }
export const PointerOnIt: Story = { name: 'Pointer on it', ...one(doc({ d: 1, n: 12 })), parameters: { pseudo: { hover: ['button'] } } }
