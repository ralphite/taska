import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Dash, Round } from '../../model/dashboard'
import { Frames } from '../../stories/Frames'
import { Dashboard } from './Dashboard'

const meta: Meta = { title: 'Components/Settings, help and parts/Dev/Dashboard' }
export default meta
type Story = StoryObj

// rounds of work handed over this week, the latest first: minutes, and tokens when the cost line gave them
const NOW = Date.parse('2026-10-23T22:40:00-07:00')
const ROUNDS: Round[] = (
  [
    ['B593', 'Story and page the same', 12, 96000],
    ['T550', 'Input box states', 46, null],
    ['B510', 'Finished and asks you', 52, 131000],
    ['B573', 'Left border regression', 39, null],
    ['F554', 'Desktop frame width', 8, 42000],
    ['T468', 'Review over-design', 3114, null],
    ['B555', 'Only real states', 198, 610000],
    ['F479', 'Search everything', 74, null],
    ['B584', 'Selecting words', 3, 18000],
    ['T501', 'Web documents tested', 260, 880000],
    ['B606', 'Priority first', 17, null],
    ['F568', 'Two versions of a voice note', 21, 64000],
  ] as const
).map(([code, title, m, tokens], i) => {
  const end = new Date(NOW - i * 3 * 3600_000)
  return { project: 'taska', code, title, end: end.toISOString(), at: `10-${String(23 - Math.floor(i / 8)).padStart(2, '0')} ${String(end.getHours()).padStart(2, '0')}:00`, minutes: m, tokens }
})

const d: Dash = {
  days: 7,
  from: '10-17 09:12',
  to: '10-23 22:40',
  actions: 1284,
  tabs: 37,
  top: [['Open an item', 412], ['Send', 233], ['Send a voice note', 120], ['Esc', 98]],
  span: ['10-17', '10-18', '10-19', '10-20', '10-21', '10-22', '10-23'].map((k, i) => [k, [120, 80, 210, 160, 300, 240, 174][i]]),
  hourly: false,
  via: [['this computer', 900], ['phone', 384]],
  projects: [['taska', 1000], ['home', 284]],
  items: [{ project: 'taska', code: 'F581', title: 'The rewrite', n: 44 }],
  opens: 412,
  opened: 96,
  voice: { n: 140, ends: [['sent as it was', 120], ['words into the box', 15], ['discarded', 5]], median: 24, minutes: 61 },
  errors: [['Not saved', 3]],
  slow: { n: 22, timeouts: 1, median: 1800, via: [['phone', 18, 2100], ['this computer', 4, 1200]], where: [['/p/*/api/changes', 12]] },
  reloads: 9,
  updates: 4,
  costs: { items: [{ project: 'taska', code: 'B533', title: 'A bug', rounds: 2, minutes: 14, tokens: 96000, cache: 8100000, steps: 41, t: '10-23 21:02' }], minutes: 14, tokens: 96000, cache: 8100000, median_minutes: 14, median_tokens: 96000 },
  rounds: ROUNDS,
  panels: [{ name: 'storybook.md', updated: '10-23 22:00', title: 'Storybook', md: 'Up on 6007, 214 stories.' }],
  analyses: [{ name: '2026-10-22-speed.md', date: '2026-10-22', title: 'Where the time goes', md: 'Mostly waiting for the tunnel.' }],
}

/** A week of what you did; the panels, costs and analyses agents keep. */
export const Week: Story = { name: 'The last 7 days', render: () => <Frames phoneWidth={393} deskWidth={1200} page>{() => <Dashboard d={d} err="" range="7" onRange={() => {}} rounds="last20" now={NOW} onRounds={() => {}} />}</Frames> }

/** Before Taska answers. */
export const Loading: Story = { name: 'Loading', render: () => <Frames phoneWidth={393} deskWidth={1200} page>{() => <Dashboard d={null} err="" range="7" onRange={() => {}} rounds="last20" now={NOW} onRounds={() => {}} />}</Frames> }
// ---- more states (T639)
const show = (dash: Dash | null, err = '', range = '7'): Story['render'] => () => <Frames phoneWidth={393} deskWidth={1200} page>{() => <Dashboard d={dash} err={err} range={range} onRange={() => {}} rounds="last20" now={NOW} onRounds={() => {}} />}</Frames>
/** Taska answered with an error, still working it out */
export const TaskaSaidNo: Story = { name: 'Taska said no', render: show(null, 'Taska answered 500') }
/** another range asked for and refused: the error over the numbers from before */
export const TaskaSaidNoOverData: Story = { name: 'Taska said no, the numbers from before stay', render: show(d, 'Taska answered 500') }
/** today, by hour: a label under every third hour */
export const Today: Story = { name: 'Today, by hour', render: show({ ...d, days: 1, hourly: true, span: Array.from({ length: 24 }, (_, h) => [String(h).padStart(2, '0'), [0, 0, 0, 0, 0, 0, 0, 2, 10, 30, 22, 18, 9, 14, 40, 35, 20, 12, 8, 6, 4, 2, 0, 0][h]]) }, '', '0') }
/** nothing yet: every list empty, no panels, no costs, no analyses */
export const NothingYet: Story = {
  name: 'Nothing yet',
  render: show({ ...d, actions: 0, tabs: 0, top: [], span: [], via: [], projects: [], items: [], opens: 0, opened: 0, voice: { n: 0, ends: [], median: 0, minutes: 0 }, errors: [], slow: { n: 0, timeouts: 0, median: 0, via: [], where: [] }, reloads: 0, updates: 0, costs: { ...d.costs, items: [], minutes: 0, tokens: 0, cache: 0, median_minutes: 0 }, rounds: [], panels: [], analyses: [] }),
}
/** rounds handed over but none says its tokens; more than 30 of them */
export const NoTokensManyRounds: Story = {
  name: 'No tokens, many rounds',
  render: show({ ...d, rounds: Array.from({ length: 36 }, (_, i) => ({ ...ROUNDS[i % ROUNDS.length], code: `T${600 + i}`, tokens: null })) }),
}
