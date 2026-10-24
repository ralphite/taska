import type { Meta, StoryObj } from '@storybook/react-vite'
import { SheetFrames } from '../../stories/sheetFixtures'
import { signInSheet } from './SignIn'

const meta: Meta = { title: 'Components/Project/Sign in' }
export default meta
type Story = StoryObj

/** From outside this computer's network: the key, asked for in the page. */
export const KeyRequired: Story = { render: () => <SheetFrames height={320} parts={() => signInSheet(() => {})} /> }
