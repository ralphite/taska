// The one New project, wherever it is asked (the sidebar, the home page, Settings; D115 #7): the popover on the
// desktop, the sheet on the phone; nothing typed, a name typed (its tile as it will be), and why it was not made.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../stories/Frames'
import { withNewProject } from '../stories/newProjectFixtures'

export default { title: 'UI/Left sidebar/Projects list/A new project/The form' } satisfies Meta
type Story = StoryObj

const at = (value: string, error = ''): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={480} height={360}>{(layout) => withNewProject(null, layout === 'desk', { at: { x: 16, y: 16 }, value, error })}</Frames>,
})
export const Empty: Story = { ...at(''), name: 'Nothing typed' }
export const TheForm: Story = { ...at('Garden'), name: 'Naming it' }
export const NotMade: Story = { ...at('Shop', 'A project of that name exists'), name: 'Not made' }
/** a name with no a-z or 0-9: its address is picked by chance, so its colour is not known yet (grey) */
export const AnyName: Story = { ...at('读书笔记'), name: 'Any name' }
