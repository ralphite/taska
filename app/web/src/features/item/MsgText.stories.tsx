// The parts a message is made of (T591: the groups and names Yadong had before the rewrite): its words in Markdown,
// its voice note under the pointer. The page's own message words and talk.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { input, item, message, modelOf } from '../../stories/fixtures'
import { noItemEvents, talkEnv } from '../../stories/itemFixtures'
import { talkOf } from '../../stories/itemPage'
import { MsgText } from './MsgText'

export default { title: 'Components/Conversation/Message parts' } satisfies Meta
type Story = StoryObj

const MD = '**Result**: the export keeps the filter.\n\n- with the filter\n- with the sort\n\n`npm run check` passes; see [the plan](#D1) and F014.\n\n> The old export stays a week.'

export const Markdown: Story = {
  render: () => <Frames phoneWidth={393} deskWidth={640}>{(layout) => <div className="p-3 text-[15px]"><MsgText x={message({ id: 1, text: MD })} env={talkEnv(modelOf([]), layout === 'desk')} on={noItemEvents} /></div>}</Frames>,
}
export const VoiceNotePointerOnIt: Story = {
  name: 'Voice note, pointer on it',
  parameters: { pseudo: { hover: ['button'] } },
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {(layout) =>
        talkOf(item({ n: 12, thread: [message({ id: 1, by: 'you', kind: 'say', text: 'Keep the filter.', src: 'r4' })] }), layout === 'desk', {
          inputs: [input({ id: 'r4', text: 'Keep the filter.', files: [{ f: 'f2-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }] })],
        })
      }
    </Frames>
  ),
}
