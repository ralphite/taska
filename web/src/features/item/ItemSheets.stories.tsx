// What an item came from (T591: Menus and sheets > Sheets): the page's own sheet with the inputs that made it, from
// its chip in the item's head; what an agent reading it gets (F568), from its menu. A message's menu is in
// stories/OtherMenus.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { input, item, modelOf, T } from '../../stories/fixtures'
import { talkEnv } from '../../stories/itemFixtures'
import { act, acts, opened } from '../../stories/menuFixtures'
import { Thumbs } from '../../ui/Files'
import { agentCardSheet, sourcesSheet } from './ItemSheets'

export default { title: 'Components/Around the page/Menus and sheets/Sheets/An item: what it came from, what agents see' } satisfies Meta
type Story = StoryObj

const fileOn = acts('A file', ['play', 'words', 'view'])

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
        return opened(sourcesSheet({ code: 'F012', inputs, world: env.world, now: m.at, files: (f) => <Thumbs files={f} url={env.url} play={env.play} tidy on={fileOn} /> }, act('What an item came from: go to input')), layout === 'desk')
      }}
    </Frames>
  ),
}

const CARD = `F012 bug P1 now open  Export keeps the filter
src r12 r15
body:
The export should keep the filter I set.
thread:
#40 10-30 13:20 you: And the sort, please. [f4-voice_0-07.webm]
reference: the user's own words (the inputs it came from):
r12 10-30 12:20: in the body above
r15 10-30 13:20: in the thread above (#40)
`
export const WhatAgentsSee: Story = {
  name: 'What agents see',
  render: () => <Frames height={420} deskWidth={900} phoneWidth={393}>{(layout) => opened(agentCardSheet('F012', CARD), layout === 'desk')}</Frames>,
}
export const WhatAgentsSeeLoading: Story = {
  name: 'What agents see: loading',
  render: () => <Frames height={220} deskWidth={900} phoneWidth={393}>{(layout) => opened(agentCardSheet('F012', null), layout === 'desk')}</Frames>,
}
// ---- more states (T639): what the organizer made of each input, and an input that is only a voice note
const filed = [
  input({ id: 'r12', t: at(90), acked: true, touched: [12], text: 'The export should keep the filter I set.', org: { ok: true, msg: 'Created F012', t: '', keep: false, changed: true, undone: false } }),
  input({ id: 'r15', t: at(30), acked: true, touched: [12], text: '', files: [{ f: 'f4-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm' }], org: { ok: true, msg: 'Noted on F012', t: '', keep: false, changed: true, undone: false } }),
]
const mf = modelOf([item({ n: 12, srcs: ['r12', 'r15'] })], filed)
export const SourcesFiled: Story = {
  name: 'What an item came from: what the organizer made of each, a voice note alone',
  render: () => (
    <Frames height={520} deskWidth={900} phoneWidth={393}>
      {(layout) => {
        const env = talkEnv(mf, layout === 'desk')
        return opened(sourcesSheet({ code: 'F012', inputs: filed, world: env.world, now: mf.at, files: (f) => <Thumbs files={f} url={env.url} play={env.play} tidy on={fileOn} /> }, act('What an item came from: go to input')), layout === 'desk')
      }}
    </Frames>
  ),
}
