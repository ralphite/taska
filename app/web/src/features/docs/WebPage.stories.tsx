// A web page an agent wrote, as it is read (T591: Reading > Web page): the page's own webFacts and WebPage with a demo
// page, run in its own frame, in the desktop's pane and the phone's sheet. Commenting on it is in
// WebPageCommenting.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { WEB } from '../../stories/docFixtures'
import { docAt } from '../../stories/docPage'

export default { title: 'Components/Document/Reading' } satisfies Meta
type Story = StoryObj

/** Each thread's count in its part's corner. */
export const WebPage: Story = { name: 'Web page', render: () => <Frames height={640} deskWidth={900} phoneWidth={393}>{(layout) => docAt(WEB, layout === 'desk')}</Frames> }
