// The home page with every project: under the pointer, pressed, from the keys; loading; no projects yet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { shown } from '../../stories/homeFixtures'

export default { title: 'Components/Around the page/Home page/Your projects' } satisfies Meta
type Story = StoryObj

/** Every project with its agent, open count, what needs you and the first of it. */
export const Projects: Story = { name: 'Every project', render: () => shown({}) }

/** A project under the pointer, pressed, from the keys, side by side. */
export const HomeLooks: Story = {
  name: 'Pointer, pressed, keys: all side by side',
  parameters: { pseudo: { hover: ['[data-look="pointer"] a[href="/p/home/"]'], active: ['[data-look="pressed"] a[href="/p/home/"]'], focusVisible: ['[data-look="keys"] a[href="/p/home/"]'] } },
  render: () => (
    <div className="flex flex-col gap-6">
      {(['pointer', 'pressed', 'keys'] as const).map((look) => (
        <div key={look} data-look={look}>
          <p className="px-6 pt-2 font-mono text-[10px] text-zinc-400">{look === 'keys' ? 'keys (the browser draws the ring itself)' : look}</p>
          {shown({}, 420)}
        </div>
      ))}
    </div>
  ),
}

/** Loading, the first time in this browser. */
export const Loading: Story = { render: () => shown({ rows: null }, 260) }

/** No projects yet. */
export const NoProjects: Story = { name: 'No projects', render: () => shown({ rows: [], needs: 0 }, 260) }
// ---- more states (T639)
/** the search box focused (a click on it, or ⌘K): its blue ring */
export const SearchFocused: Story = { name: 'Search box: focused', parameters: { pseudo: { focusWithin: ['label:has(input)'] } }, render: () => shown({}) }
