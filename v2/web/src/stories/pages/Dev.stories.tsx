// T521, F448: Pages > Dev: the page for making Taska, on this computer only (the dashboard of what you did)
import type { Meta, StoryObj } from '@storybook/react-vite'
import { pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Dev', parameters: pageParams('Dashboard') }
export default meta

export const Dashboard: StoryObj = { ...screen('/dev/dashboard', 'desktop'), name: 'Dashboard' }
