// The parts a message is made of: its words in Markdown (a voice note's original words under the pointer: Floating >
// Tip). The page's own message words.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { doc } from '../../stories/docFixtures'
import { Frames } from '../../stories/Frames'
import { item, message, modelOf } from '../../stories/fixtures'
import { noItemEvents, talkEnv } from '../../stories/itemFixtures'
import { MsgText } from './MsgText'

export default { title: 'Components/Conversation/Message parts/Words' } satisfies Meta
type Story = StoryObj

// what the message names is in the project: D1 and F014 are links, as on the page
const WORLD = modelOf([item({ n: 14 })], [], {}, [doc({ d: 1, n: 14 })])
const MD = '**Result**: the export keeps the filter.\n\n- with the filter\n- with the sort\n\n`npm run check` passes; see [the plan](#D1) and F014.\n\n> The old export stays a week.'

export const Markdown: Story = {
  name: 'A message’s words: Markdown, codes, links',
  render: () => <Frames phoneWidth={393} deskWidth={640}>{(layout) => <div className="p-3 text-[15px]"><MsgText x={message({ id: 1, text: MD })} env={talkEnv(WORLD, layout === 'desk')} on={noItemEvents} /></div>}</Frames>,
}
