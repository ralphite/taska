import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { RecBar } from '../../ui/PlaceVoice'
import { SelectionBar } from './SelectionBar'

const meta: Meta = { title: 'Components/Input box/Bar over selected words' }
export default meta
type Story = StoryObj

const at = { top: 40, bottom: 60, left: 60, width: 180, height: 20 }
const on = { mic: () => {}, comment: () => {}, fix: () => {}, cancel: () => {}, check: () => {}, send: () => {} }

/** Under selected words: speak about them; a document's words can be commented on, a voice note's corrected. */
export const Bar: Story = {
  name: 'Speak or comment',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={160}>
      {() => (
        <div className="relative h-40">
          <p className="pt-8 pl-14 text-[15px]">Words that were selected</p>
          <SelectionBar at={at} recording={false} comment fix={false} on={on} />
        </div>
      )}
    </Frames>
  ),
}

/** Recording a comment about them: the bar is its recording strip, where it was (✕, ✓, ↑; B498). Under it, Correct,
 * for a voice note's words. */
export const Recording: Story = {
  name: "Recording; Correct on a voice note's words",
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={200}>
      {(layout) => (
        <div className="relative h-48">
          <SelectionBar at={at} recording desk={layout === 'desk'} meter={<RecBar time="0:02" levels={[0.3, 0.75, 0.5, 0.95, 0.4, 0.65, 0.2, 0.85, 0.55, 0.35, 0.9, 0.6].slice(layout === 'desk' ? -6 : -12)} />} comment={false} fix={false} on={on} />
          <SelectionBar at={{ ...at, top: 110, bottom: 130 }} recording={false} comment={false} fix on={on} />
        </div>
      )}
    </Frames>
  ),
}
/** Words selected outside a document (an item's talk, what you said): speak about them, nothing else. */
export const SpeakOnly: Story = {
  name: 'Speak only (words outside a document)',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={160}>
      {() => (
        <div className="relative h-40">
          <p className="pt-8 pl-14 text-[15px]">Words that were selected</p>
          <SelectionBar at={at} recording={false} comment={false} fix={false} on={on} />
        </div>
      )}
    </Frames>
  ),
}
