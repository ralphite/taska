// Taska asks for its key (T591: Menus and sheets > Sheets): the page's own sheet, in the middle on both.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { opened } from '../../stories/menuFixtures'
import { signInSheet } from './SignIn'

export default { title: 'Components/Menus and sheets/Sheets' } satisfies Meta
type Story = StoryObj

export const SignIn: Story = { name: 'Sign in', render: () => <Frames height={360} deskWidth={900} phoneWidth={393}>{(layout) => opened(signInSheet(() => {}), layout === 'desk')}</Frames> }
