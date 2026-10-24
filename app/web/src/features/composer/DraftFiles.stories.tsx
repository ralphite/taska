import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PICTURE } from '../../stories/fixtures'
import { DraftFiles } from './DraftFiles'

const meta: Meta = { title: 'Components/Composer/Draft files' }
export default meta
type Story = StoryObj

/** Files in the draft: a picture going up, one up, a file, a voice note transcribed. */
export const Files: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {() => (
        <DraftFiles
          files={[
            { key: 'a', f: '', name: 'shot.png', mime: 'image/png', preview: PICTURE },
            { key: 'b', f: 'f2-shot.png', name: 'shot.png', mime: 'image/png', preview: PICTURE },
            { key: 'c', f: 'f3-report.pdf', name: 'Quarterly report.pdf', mime: 'application/pdf' },
            { key: 'd', f: 'f4-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm', ms: 12000, tr: 'Keep the filter.' },
          ]}
          url={() => PICTURE}
          onRemove={() => {}}
          onView={() => {}}
        />
      )}
    </Frames>
  ),
}
