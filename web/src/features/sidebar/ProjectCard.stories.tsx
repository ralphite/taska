// A project's card (F667): beside its row while a mouse is on it (its left edge over the sidebar's, r1066), and while
// the mouse moved into it; the same beside its icon on the folded rail; one with nothing open; dark; and the card alone
// in each of its states.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame } from '../../stories/Frames'
import { pointIntoCard, pointTo, rail, side } from '../../stories/sideFixtures'
import { projectCard } from '../../model/projects'
import { PROJECT_TONES } from '../../ui/tones'
import { ProjectCard } from './ProjectCard'

export default { title: 'Components/Around the page/Sidebar/Project card' } satisfies Meta
type Story = StoryObj

/** the sidebar with a mouse on a project (by its slug), its card beside it */
const sidebarOn = (slug: string, into = false): Story => ({
  parameters: { pseudo: { hover: into ? [] : [`a[data-slug="${slug}"]`] } },
  render: () => (
    <div className="h-[760px] bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="desk" width={240} height={700}>
        <After run={(into ? pointIntoCard : pointTo)(slug)}>{side(false)}</After>
      </Frame>
    </div>
  ),
})

/** A mouse on Home: what is open and finished there, what needs you, its inputs and documents, the agent last heard
 * of, when it last changed. */
export const OnAProject: Story = { name: 'On a project', ...sidebarOn('home') }
/** The mouse moved off Home into its card: the card stays while the mouse is on it (its name opens Home). */
export const PointerInTheCard: Story = { name: 'Pointer in the card', ...sidebarOn('home', true) }
/** Nothing open: the long name over two lines, what was finished. */
export const NothingOpen: Story = { name: 'Nothing open', ...sidebarOn('long') }
/** The sidebar folded to icons: the same card beside the icon. */
export const OnTheRail: Story = {
  name: 'Folded to icons',
  parameters: { pseudo: { hover: ['#rail a[aria-label="Home"]'] } },
  render: () => (
    <div className="h-[720px] bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="desk" width={56} height={660}>
        <After run={pointTo('Home')}>{rail()}</After>
      </Frame>
    </div>
  ),
}
export const Dark: Story = { name: 'Dark', globals: { theme: 'dark' }, ...sidebarOn('home') }

const AT = Date.parse('2026-11-04T12:00:00-08:00')
const ago = (min: number) => AT - min * 60e3
const STATES: [string, string, ReturnType<typeof projectCard>][] = [
  ['Busy: work waits, no agent for two hours', 'Home', projectCard({ open: 13, needs: 3, closed: 42, inputs: 120, docs: 6, agents: [{ name: 'codex', t: ago(120), waiting: false }], work: true, t: ago(25) }, AT)],
  ['An agent ready for work', 'Shop', projectCard({ open: 9, needs: 0, closed: 31, inputs: 48, docs: 2, agents: [{ name: 'claude-code', t: ago(1), waiting: true }], work: false, t: ago(3) }, AT)],
  ['Nothing open', 'Garden', projectCard({ open: 0, needs: 0, closed: 4, inputs: 3, docs: 0, t: ago(7 * 1440) }, AT)],
  ['Nothing yet', 'New project', projectCard({ open: 0, needs: 0, closed: 0, inputs: 0, docs: 0, t: ago(2) }, AT)],
  ['Listed before these counts', '读书笔记', projectCard({ open: 2, needs: 1 }, AT)],
]
/** The card alone, in each of its states. */
export const States: Story = {
  name: 'Its states',
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {STATES.map(([label, title, card], i) => (
        <figure key={label} className="m-0 flex flex-col gap-1">
          <figcaption className="font-sans text-xs text-zinc-500">{label}</figcaption>
          <ProjectCard title={title} tone={PROJECT_TONES[i % PROJECT_TONES.length]} card={card} />
        </figure>
      ))}
    </div>
  ),
}
