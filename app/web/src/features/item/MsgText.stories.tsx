import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { message, modelOf } from '../../stories/fixtures'
import { noItemEvents, talkEnv } from '../../stories/itemFixtures'
import { MsgText } from './MsgText'

const meta: Meta = { title: 'Components/Item/Message words' }
export default meta
type Story = StoryObj

const LONG = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: what the agent did, and why, in a few words.`).join('\n')
const m = modelOf([])

/** A message's words: short; long (on the desktop a fade and Show all, on the phone its first line and Show more);
 * opened; the item's latest message, whole. */
export const Words: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {(layout) => {
        const desk = layout === 'desk'
        const words = (x: ReturnType<typeof message>, f: Partial<ReturnType<typeof talkEnv>> = {}) => (
          <div className="p-3 text-[15px]">
            <MsgText x={x} env={talkEnv(m, desk, f)} on={noItemEvents} />
          </div>
        )
        return (
          <States
            items={[
              ['short', words(message({ id: 1 }))],
              ['long', words(message({ id: 2, text: LONG }))],
              ['long, opened', words(message({ id: 3, text: LONG }), { opened: new Set([3]) })],
              ['long, the latest message', words(message({ id: 4, text: LONG }), { latest: 4 })],
            ]}
          />
        )
      }}
    </Frames>
  ),
}
