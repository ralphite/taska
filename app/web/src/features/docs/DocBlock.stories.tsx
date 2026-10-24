import type { Meta, StoryObj } from '@storybook/react-vite'
import { doc } from '../../stories/docFixtures'
import { Frames } from '../../stories/Frames'
import { DocBlock } from './DocBlock'

const meta: Meta = { title: 'Components/Document/Paragraph' }
export default meta
type Story = StoryObj

const world = { find: () => null, url: (f: string) => '#' + f, size: () => undefined }

/** Each kind of paragraph as a document draws it, the first as the title. */
export const Kinds: Story = {
  render: () => (
    <Frames height={640} deskWidth={600}>
      {() => (
        <div className="space-y-3 p-6 text-[15px]">
          {doc().blocks.map((b, i) => (
            <DocBlock key={b.key} b={b} title={i === 0} world={world} />
          ))}
        </div>
      )}
    </Frames>
  ),
}
