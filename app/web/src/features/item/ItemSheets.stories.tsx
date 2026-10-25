// What an item came from (T591: Menus and sheets > Sheets): the page's own sheet with the inputs that made it, from
// its chip in the item's head. A message's menu is in stories/OtherMenus.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { input, item, modelOf, T } from '../../stories/fixtures'
import { talkEnv } from '../../stories/itemFixtures'
import { no, opened } from '../../stories/menuFixtures'
import { Thumbs } from '../../ui/Files'
import { sourcesSheet } from './ItemSheets'

export default { title: 'Components/Menus and sheets/Sheets' } satisfies Meta
type Story = StoryObj

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const inputs = [
  input({ id: 'r12', t: at(90), acked: true, touched: [12], text: 'The export should keep the filter I set.', files: [{ f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }] }),
  input({ id: 'r15', t: at(30), acked: true, touched: [12], text: 'And the sort, please.', files: [{ f: 'f4-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm' }] }),
]
const m = modelOf([item({ n: 12, srcs: ['r12', 'r15'] })], inputs)

export const Sources: Story = {
  name: 'What an item came from',
  render: () => (
    <Frames height={520} deskWidth={900} phoneWidth={393}>
      {(layout) => {
        const env = talkEnv(m, layout === 'desk')
        return opened(sourcesSheet({ code: 'F012', inputs, world: env.world, now: m.at, files: (f) => <Thumbs files={f} url={env.url} play={env.play} tidy on={{ play() {}, words() {}, view() {} }} /> }, no), layout === 'desk')
      }}
    </Frames>
  ),
}
