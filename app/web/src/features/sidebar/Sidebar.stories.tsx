import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame, Frames } from '../../stories/Frames'
import { PROJECT_TONES } from '../../ui/tones'
import { Rail, Sidebar, type SideLinkInfo, type SideProject, type SidebarEvents } from './Sidebar'

const meta: Meta = { title: 'Components/Sidebar' }
export default meta
type Story = StoryObj

const on: SidebarEvents = { newInput() {}, newVoice() {}, newProject() {}, hide() {}, settings() {}, keys() {}, go: (_, e) => e.preventDefault(), undo() {} }
const projects: SideProject[] = [
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[0], needs: 11, open: 13, current: false, href: '#' },
  { slug: 'shop', title: 'Shop redesign', tone: PROJECT_TONES[1], needs: 0, open: 4, current: false, href: '#' },
  { slug: 'taska', title: 'taska', tone: PROJECT_TONES[4], needs: 2, open: 32, current: true, href: '#' },
  { slug: 'notes', title: '读书笔记', tone: PROJECT_TONES[2], needs: 1, open: 2, current: false, href: '#' },
  { slug: 'long', title: 'A project with a very long name that does not fit', tone: PROJECT_TONES[6], needs: 0, open: 0, current: false, href: '#' },
]
const links: SideLinkInfo[] = [
  { key: 'docs', label: 'Documents', icon: 'doc', href: '#', current: false },
  { key: 'log', label: 'Activity', icon: 'history', href: '#', current: true },
  { key: 'deleted', label: 'Deleted', icon: 'trash', href: '#', current: false },
]
const dev = [
  { label: 'Storybook', href: '#', icon: 'book' as const },
  { label: 'Dashboard', href: '#', icon: 'chart' as const },
]

/** The desktop's sidebar and the phone's drawer, with the projects, their counts and the foot. */
export const Projects: Story = {
  render: () => (
    <Frames phoneWidth={320} deskWidth={240} height={760}>
      {(layout) => <Sidebar phone={layout === 'phone'} projects={projects} composing={layout === 'desk'} links={links} undoLabel={layout === 'phone' ? 'T9 approved' : null} devLinks={layout === 'desk' ? dev : []} place={layout === "phone" ? "h-full bg-zinc-100" : "h-full bg-zinc-50"} on={on} />}
    </Frames>
  ),
}

/** Before the projects were ever listed in this browser. */
export const NotListedYet: Story = {
  render: () => (
    <Frames phoneWidth={320} deskWidth={240} height={420}>
      {(layout) => <Sidebar phone={layout === 'phone'} projects={null} composing={false} links={[]} place={layout === "phone" ? "h-full bg-zinc-100" : "h-full bg-zinc-50"} on={on} />}
    </Frames>
  ),
}

/** The sidebar folded: the rail. */
export const Folded: Story = {
  render: () => (
    <div className="flex gap-6 bg-zinc-200 p-6">
      {(['light', 'dark'] as const).map((theme) => (
        <Frame key={theme} layout="desk" theme={theme} width={56} height={560} label={theme}>
          <Rail projects={projects} composing settingsOpen={false} on={on} />
        </Frame>
      ))}
    </div>
  ),
}
