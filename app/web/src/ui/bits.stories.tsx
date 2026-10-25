import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { PICTURE } from '../stories/fixtures'
import { Count, DraftMark, Empty, Pic, SectionHead, Soft } from './bits'

const meta: Meta = { title: 'Components/Icons and marks/Other marks' }
export default meta
type Story = StoryObj

/** The small parts rows and heads are made of (key caps, tiles, agents and searched words have their own groups). */
export const Bits: Story = {
  name: 'Quiet words, counts, a draft, a section head, an empty list, a picture',
  render: () => (
    <Frames phoneWidth={393} deskWidth={560}>
      {() => (
        <States
          items={[
            ['quiet words, counts, a draft', <div className="flex items-center gap-3 p-3 text-xs"><Soft>Later</Soft><Count icon="comment" n={4} label="4 messages" /><DraftMark /><DraftMark small /></div>],
            ['a section head', <SectionHead text="Needs you" right={<span className="text-xs text-zinc-400">3</span>} />],
            ['an empty list', <Empty>Nothing needs you.</Empty>],
            ['a picture', <div className="size-20 p-3"><Pic src={PICTURE} alt="A screenshot" cls="size-full object-contain" /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
