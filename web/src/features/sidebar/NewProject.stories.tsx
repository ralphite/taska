// New project from the sidebar (D115 #7): a small popover at its button on the desktop (from the rail too), a sheet on
// the phone: New project, its tile as it will be, its name (any name: its address is made from it), Create; and why it
// was not made.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { rail, side } from '../../stories/sideFixtures'

export default { title: 'Components/Around the page/Sidebar/A new project' } satisfies Meta
type Story = StoryObj

export const NewProject: Story = { name: 'Naming it', render: () => <Frames phoneWidth={393} deskWidth={640} height={760}>{(layout) => side(layout === 'phone', { naming: '', namingValue: 'Garden', width: 240 })}</Frames> }
export const NewProjectNotMade: Story = { name: 'Not made', render: () => <Frames phoneWidth={393} deskWidth={640} height={760}>{(layout) => side(layout === 'phone', { naming: 'A project of that name exists', namingValue: 'Shop', width: 240 })}</Frames> }
/** nothing typed yet: a grey tile, Create not to be pressed */
export const NewProjectEmpty: Story = { name: 'Opened, nothing typed', render: () => <Frames phoneWidth={393} deskWidth={640} height={760}>{(layout) => side(layout === 'phone', { naming: '', width: 240 })}</Frames> }
/** from the folded sidebar's rail: the popover at its + */
export const FromTheRail: Story = { name: 'From the rail', render: () => <Frames phone={false} deskWidth={640} height={760}>{() => rail({ naming: '' })}</Frames> }
