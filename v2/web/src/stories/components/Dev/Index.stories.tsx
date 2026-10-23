// F448, F508: what is there for making Taska, on this computer only: the dashboard of what you did (on the demo's
// numbers) and the links to it and to Storybook, in a section of their own in the sidebar.
// B555: the real page at the dashboard's address, and the sidebar's Dev links where the page has them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { place } from '../../lib/onpage'

const meta: Meta = {
  title: 'Components/Dev',
  parameters: { covers: ['Dashboard', 'Card', 'Bars', 'Stat', 'DevLinks'] },
}
export default meta

export const DashboardPage: StoryObj = {
  ...place({ at: '/dev/dashboard', part: '#root > *' }, 'desktop'),
  name: 'Dashboard',
}
export const Links: StoryObj = {
  ...place({ at: '/p/shop/', part: '#devLinks' }, 'desktop'),
  name: 'Dev links in the sidebar',
}
