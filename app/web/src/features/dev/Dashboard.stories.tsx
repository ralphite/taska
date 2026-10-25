import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Dash } from '../../model/dashboard'
import { Frames } from '../../stories/Frames'
import { Dashboard } from './Dashboard'

const meta: Meta = { title: 'Pages/Dashboard' }
export default meta
type Story = StoryObj

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
  panels: [{ name: 'storybook.md', updated: '10-23 22:00', title: 'Storybook', md: 'Up on 6007, 214 stories.' }],
  analyses: [{ name: '2026-10-22-speed.md', date: '2026-10-22', title: 'Where the time goes', md: 'Mostly waiting for the tunnel.' }],
}

/** A week of what you did; the panels, costs and analyses agents keep. */
export const Week: Story = { render: () => <Frames phoneWidth={393} deskWidth={1200} page>{() => <Dashboard d={d} err="" range="7" onRange={() => {}} />}</Frames> }

/** Before Taska answers. */
export const Loading: Story = { render: () => <Frames phoneWidth={393} deskWidth={1200} page>{() => <Dashboard d={null} err="" range="7" onRange={() => {}} />}</Frames> }
