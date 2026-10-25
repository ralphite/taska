import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { SelectionBar } from './SelectionBar'

const meta: Meta = { title: 'Components/Input box/Selection bar' }
export default meta
type Story = StoryObj

const at = { top: 40, bottom: 60, left: 60, width: 180, height: 20 }
const on = { mic: () => {}, comment: () => {}, fix: () => {} }

/** Under selected words: speak about them; a document's words can be commented on, a voice note's corrected. */
export const Bar: Story = {
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

/** Recording a comment about them: the same button stops it. With Correct, for a voice note's words. */
export const Recording: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={160}>
      {() => (
        <div className="relative h-40">
          <SelectionBar at={at} recording comment={false} fix={false} on={on} />
          <SelectionBar at={{ ...at, left: 260 }} recording={false} comment={false} fix on={on} />
        </div>
      )}
    </Frames>
  ),
}
