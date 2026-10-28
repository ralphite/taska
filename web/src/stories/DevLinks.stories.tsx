// The links for development at the sidebar's foot (T591: Dev): Storybook and the dashboard, on this computer only
// (the page shows them when it is opened from localhost): the page's own sidebar.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { side } from './sideFixtures'

export default { title: 'Components/Dev' } satisfies Meta
type Story = StoryObj

export const DevLinks: Story = { name: 'Dev links in the sidebar', render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false)}</Frames> }
