// The one form for naming a new project (the sidebar, the home page, Settings): naming it, and why it was not made.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { NewProjectForm } from './NewProjectForm'
import { act } from '../stories/acts'

export default { title: 'Components/Around the page/Sidebar/A new project/The form' } satisfies Meta
type Story = StoryObj

// what it makes or stops is its place's (the sidebar, Home, Settings): the Actions panel
const onCreate = act('New project: create')
const onCancel = act('New project: cancel')

export const TheForm: Story = {
  name: 'Naming it, not made',
  render: () => (
    <Frames phoneWidth={393} deskWidth={420}>
      {() => (
        <States
          items={[
            ['naming it', <div className="p-3"><NewProjectForm value="Garden" error="" onCreate={onCreate} onCancel={onCancel} /></div>],
            ['not made: why', <div className="p-3"><NewProjectForm value="Shop" error="A project of that name exists" onCreate={onCreate} onCancel={onCancel} /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
