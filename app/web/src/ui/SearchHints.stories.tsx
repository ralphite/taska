import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { T } from '../stories/fixtures'
import { PROJECT_TONES } from './tones'
import { SearchHints } from './SearchHints'

const meta: Meta = { title: 'Components/List/Search hints' }
export default meta
type Story = StoryObj

const hits = [
  { project: 'home', ptitle: 'Home', kind: 'item' as const, code: 'I01', title: 'A speaker that plays from an API', status: 'open' as const, archived: false, t: T },
  { project: 'lumina', ptitle: 'lumina', kind: 'item' as const, code: 'B14', title: 'Voice notes cut off at 60 s', status: 'done' as const, archived: false, t: T },
  { project: 'todos', ptitle: 'todos', kind: 'input' as const, code: '#11', title: 'Record a voice note about the trip', t: T },
]
const hints = (p: Partial<Parameters<typeof SearchHints>[0]>) => (
  <div className="flex flex-col py-4">
    <SearchHints other={[]} cross={null} tone={(s) => PROJECT_TONES[s.length % PROJECT_TONES.length]} onShow={() => {}} onGo={() => {}} {...p} />
  </div>
)

/** Under a search: matches in the other tabs, and the other projects (searching, none, could not search, found). */
export const Hints: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['matches in other tabs', hints({ other: [['inputs', 3], ['rules', 1]] })],
            ['searching the other projects', hints({ cross: { q: 'voice', list: null, failed: false } })],
            ['not in other projects', hints({ cross: { q: 'voice', list: [], failed: false } })],
            ['could not search', hints({ cross: { q: 'voice', list: null, failed: true } })],
            ['found in other projects', hints({ cross: { q: 'voice', list: hits, failed: false } })],
          ]}
        />
      )}
    </Frames>
  ),
}
