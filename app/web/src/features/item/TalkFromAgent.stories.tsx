// A message from an agent in an item's talk, one story for each kind and state (T591: the groups and names Yadong had
// before the rewrite): the page's own talk (ItemTalk) with that item's data (../../stories/itemPage).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item, Message } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, item, message } from '../../stories/fixtures'
import { talkOf, you, type PageOpts } from '../../stories/itemPage'

export default { title: 'Components/Conversation/Message/From an agent' } satisfies Meta
type Story = StoryObj

const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
const LONG = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: what the agent did, and why, in a few words.`).join('\n')
const at = (thread: Message[], o: PageOpts = {}, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', o)}</Frames>,
})
const after = (x: Message) => [x, you(9, 'Thanks.')].map((m, i) => (i ? { ...m, t: later(5) } : m))

export const Progress = at([message({ id: 2 })])
export const Reply = at([you(1, 'Does it keep the sort too?'), message({ id: 2, kind: 'say', text: 'Yes: the export writes the rows in the order the list shows.', t: later(2) })])
export const ToAnotherSession: Story = { ...at([message({ id: 2, to: ['worker-b'], text: '@worker-b take the tests for the export' })]), name: 'To another session (→ worker)' }
export const PointerOnIt: Story = { ...at([message({ id: 2 })]), name: 'Pointer on it: ⋯ shows', parameters: { pseudo: { hover: ['.group'] } } }
export const LongCutShowAll: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Long: cut, Show all' }
export const LongPressedToOpen: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Long: pressed to open', parameters: { pseudo: { active: ['button[data-more]'] } } }
export const LongOpenedShowLess: Story = { ...at(after(message({ id: 2, text: LONG })), { env: { opened: new Set([2]) } }), name: 'Long: opened, Show less' }
export const LatestMessageWhole: Story = { ...at([message({ id: 2, text: LONG })]), name: 'Latest message: whole however long' }
export const FinishedReport = at(
  [message({ id: 6, text: '**Result**: the export writes the rows the list shows.\n\n**How to check**: filter the list, then Export.\n\n**What changed**\n- the export reads the list\n- the file name says the filter' })],
  {},
  { status: 'review' },
)
export const WithPictures = at([message({ id: 2, text: 'Before and after:', files: [{ f: 'f1-before.png', name: 'before.png', mime: 'image/png' }, { f: 'f2-after.png', name: 'after.png', mime: 'image/png' }] })])
export const BlockedAnsweredSince: Story = { ...at([message({ id: 2, kind: 'block', text: 'I need the API key for staging.' }), { ...you(3, 'It is in the vault, under staging.'), t: later(4) }]), name: 'Blocked (answered since)' }
export const Proposal = at([message({ id: 2, kind: 'propose', text: 'Put the filter in the file name.' }), { ...message({ id: 3, text: 'Started on it.' }), t: later(3) }])
export const Decision = at([message({ id: 2, kind: 'decide', text: 'CSV it is; Excel later (F016).' })])
export const FromCodex = at([message({ id: 2, by: 'codex', ses: 'tests', text: 'The export tests pass with three filters.' })])
export const FromTheOrganizer = at([message({ id: 2, by: 'org', kind: 'say', src: 'r4', text: 'Added to F012: keep the filter' })])
export const HiddenOneLine: Story = { ...at([message({ id: 2, hidden: true })]), name: 'Hidden: one line' }
export const HiddenShownAgain: Story = { ...at([message({ id: 2, hidden: true })], { t: { peeking: new Set([2]) } }), name: 'Hidden, shown again' }
