// F448, F508: what is there for making Taska, on this computer only: the dashboard of what you did (on the demo's
// numbers) and the links to it and to Storybook, in a section of their own in the sidebar
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DevLinks } from '../../../components/Shell'
import { Dashboard } from '../../../pages/Dashboard'

const meta: Meta = {
  title: 'Components/Dev',
  parameters: { covers: ['Dashboard', 'Card', 'Bars', 'Stat', 'DevLinks'], platform: 'desktop' },
}
export default meta

export const DashboardPage: StoryObj = {
  name: 'Dashboard',
  render: () => (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100">
      <Dashboard />
    </div>
  ),
}
export const Links: StoryObj = {
  name: 'Dev links in the sidebar',
  render: () => (
    <div className="w-60 bg-zinc-50 py-2 dark:bg-zinc-900">
      <DevLinks />
    </div>
  ),
}
