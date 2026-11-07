// A long message: cut with Show all, pressed to open, opened with Show less; the latest message whole however long.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { LONG, after, at } from '../../stories/talkFromAgentFixtures'

export default { title: 'UI/Item pane/Talk/Message/From an agent/Long messages' } satisfies Meta
type Story = StoryObj

export const LongCutShowAll: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Cut: Show all' }
export const LongPressedToOpen: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Pressed to open', parameters: { pseudo: { active: ['button[data-more]'] } } }
export const LongOpenedShowLess: Story = { ...at(after(message({ id: 2, text: LONG })), { env: { opened: new Set([2]) } }), name: 'Opened: Show less' }
export const LatestMessageWhole: Story = { ...at([message({ id: 2, text: LONG })]), name: 'Latest message: whole however long' }
// ---- more states (T639)
/** sixty lines, as an agent reports a full run of checks */
const CHECKS = [
  'CSV keeps the status filter',
  'CSV keeps the date filter',
  'CSV keeps both filters together',
  'CSV keeps the sort by total',
  'CSV keeps the sort by date',
  'CSV columns follow the list',
  'CSV column names match the list',
  'CSV quotes commas in addresses',
  'CSV writes refunds as their own rows',
  'CSV writes the shipping cost',
  'Excel keeps the status filter',
  'Excel keeps the date filter',
  'Excel keeps the sort by total',
  'Excel dates use the Settings format',
  'Excel totals are numbers, not text',
  'Excel opens without a repair warning',
  'Excel sheet is named after the filter',
  'Excel freezes the header row',
  'Excel writes ten thousand rows in under 3 s',
  'Excel keeps leading zeros in order numbers',
  'File name says the status filter',
  'File name says the date range',
  'File name has no spaces',
  'File name is the same on the phone',
  'File name drops characters Windows refuses',
  'Empty list says Nothing to export',
  'Empty list writes no file',
  'A failed export says why',
  'A failed export can be tried again',
  'Export button is disabled while it runs',
  'Phone: Export button is reachable',
  'Phone: the file opens in Files',
  'Phone: the share sheet offers Mail',
  'Phone: a filter set on the phone is kept',
  'Phone: landscape keeps the button in view',
  'Selected orders only: CSV',
  'Selected orders only: Excel',
  'Selected orders only: none selected says so',
  'Selected orders only: the count is in the file name',
  'Selected orders only: the sort is kept',
  'Filter from the address is read on a fresh load',
  'Filter from the address survives Back',
  'Filter from the address survives a refresh',
  'A filter typed by hand in the address is ignored when invalid',
  'Two tabs with different filters export their own',
  'Dark mode: the export sheet reads well',
  'Keyboard: E opens the export',
  'Keyboard: Esc closes the export sheet',
  'Screen reader: the button says what it exports',
  'Screen reader: the done message is read out',
  'Old exports in Downloads are not touched',
  'The export log has one line per export',
  'The log does not hold customer names',
  'Exports over 50 MB are refused with a message',
  'The API export endpoint keeps the filter',
  'The nightly report still uses all orders',
  'The warehouse script still reads the CSV',
  'Finance sample from last Monday matches',
  'Timing: 212 orders in 0.4 s',
]
const VERY_LONG = ['Ran the export checks: 57 pass, 2 fail (marked ✗).', ...CHECKS.map((c, i) => `${i === 18 || i === 53 ? '✗' : '✓'} ${c}`)].join('\n')
/** the latest message is shown whole up to 50 lines; past that it is cut after all */
export const LatestMessagePast50Lines: Story = { ...at([message({ id: 2, text: VERY_LONG })]), name: 'Latest message past 50 lines: cut after all' }
