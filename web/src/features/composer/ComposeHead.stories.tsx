// The project's name over the New input page on the desktop: one of the page's parts, with what you said lately
// (SaidLately.stories) in the same group.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PROJECT_TONES } from '../../ui/tones'
import { ComposeHead } from './ComposeHead'

export default { title: 'Components/Inputs/New input page' } satisfies Meta
type Story = StoryObj

export const ProjectHead: Story = {
  name: 'Project name',
  render: () => (
    <Frames phone={false} deskWidth={1024}>
      {() => (
        <div className="pt-10">
          <ComposeHead title="Shop" tone={PROJECT_TONES[1]} />
        </div>
      )}
    </Frames>
  ),
}
