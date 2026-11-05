import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { T } from '../stories/fixtures'
import { PROJECT_TONES } from './tones'
import { SearchHints } from './SearchHints'
import { act } from '../stories/acts'

const meta: Meta = { title: 'Components/Item list/Search and filters' }
export default meta
type Story = StoryObj

const hits = [
  { project: 'home', ptitle: 'Home', kind: 'item' as const, code: 'I01', title: 'A speaker that plays from an API', status: 'open' as const, archived: false, t: T },
  { project: 'lumina', ptitle: 'lumina', kind: 'item' as const, code: 'B14', title: 'Voice notes cut off at 60 s', status: 'done' as const, archived: false, t: T },
  { project: 'todos', ptitle: 'todos', kind: 'input' as const, code: '#11', title: 'Record a voice note about the trip', t: T },
]
const hints = (p: Partial<Parameters<typeof SearchHints>[0]>) => (
  <div className="flex flex-col py-4">
    <SearchHints other={[]} cross={null} tone={(s) => PROJECT_TONES[s.length % PROJECT_TONES.length]} onShow={act('Search hints: show the tab')} onGo={act('Search hints: go')} {...p} />
  </div>
)

/** Under a search: matches in the other tabs, and the other projects (searching, none, out of reach and asking again, refused, found). */
export const Hints: Story = {
  name: 'Hints as you type',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['matches in other tabs', hints({ other: [['inputs', 3], ['rules', 1]] })],
            ['searching the other projects', hints({ cross: { q: 'voice', list: null, failed: false } })],
            ['not in other projects', hints({ cross: { q: 'voice', list: [], failed: false } })],
            ['out of reach: asking again', hints({ cross: { q: 'voice', list: null, failed: false, waiting: true } })],
            ['Taska refused the search', hints({ cross: { q: 'voice', list: null, failed: true } })],
            ['found in other projects', hints({ cross: { q: 'voice', list: hits, failed: false } })],
          ]}
        />
      )}
    </Frames>
  ),
}
// ---- more states (T639)
/** what a search for "export" finds: the app's items (lumina) and the home ones, in turn */
const FOUND = [
  'Export keeps the filter you set',
  'Export the bank statements as one CSV',
  'Excel export',
  'Export the tax receipts for the accountant',
  'Export dates use the format from Settings',
  'Export the photo backup list',
  'Export column order matches the list',
  'Export the shopping list to Notes',
  'Put the filter in the export file name',
  'Export the car service history',
  'Export refunds as their own rows',
  'Export the electricity readings by month',
  'Export shipping costs with each order',
  'Export the contacts for the wedding invitations',
  'Say why an export failed',
  'Export last year’s medical bills',
  'Export with ten thousand orders under 3 seconds',
  'Export the recipes to a PDF',
  'Export sheet in dark mode',
  'Export the warranty list',
  'Export keeps leading zeros in order numbers',
  'Export the school calendar to Google Calendar',
  'Export opens in Files on the iPhone',
  'Export the holiday budget',
  'Show the export’s filter at the top of the file',
  'Export the reading list from the old app',
  'Export through the API keeps the filter',
  'Export the gym log to a spreadsheet',
  'Refuse exports over 50 MB with a message',
  'Export the plant watering schedule',
]
const many = Array.from({ length: 30 }, (_, i) => ({ project: i % 2 ? 'home' : 'lumina', ptitle: i % 2 ? 'Home' : 'lumina', kind: 'item' as const, code: `T${i + 10}`, title: FOUND[i], status: (i === 1 ? 'dropped' : 'open') as 'open', archived: i === 2, t: T }))
/** many found: the first eight, "+N more · refine search", 30 shown as 30+; one archived, one won't do */
export const ManyFound: Story = { name: "Hints: many found, one archived, one won't do", render: () => <Frames phoneWidth={393} deskWidth={460}>{() => hints({ cross: { q: 'export', list: many, failed: false } })}</Frames> }
/** under a list: other tabs and other projects together */
export const TabsAndProjects: Story = { name: 'Hints: other tabs and other projects together', render: () => <Frames phoneWidth={393} deskWidth={460}>{() => hints({ other: [['inputs', 3]], cross: { q: 'voice', list: hits, failed: false } })}</Frames> }
