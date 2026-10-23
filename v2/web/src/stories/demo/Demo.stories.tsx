// T457: the real page, played by itself: what a person does, step by step, with each tap shown (R488).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Script } from '../lib/player'

const meta: Meta = {
  title: 'Demo/Needs you',
  // the frame fits the room Storybook has, with the bar under it in sight: no fixed preview size around it
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta
type Story = StoryObj

/** On the phone (a 393-wide frame): find what needs you, open the agent's proposal, approve it. */
const approve: Script = async ({ say, find, tap, wait }) => {
  say('1 / 4 · Items: what needs you is on top, in amber')
  await wait(2500)
  say('2 / 4 · Tap Needs you: only what waits on you')
  await wait(1200)
  await tap(await find('[data-act="set-filter"][data-v="wait"]'))
  await wait(1500)
  say('3 / 4 · Tap the idea the agent proposed')
  await wait(1200)
  await tap(await find('#list [data-act="open"][data-n="4"]'))
  say('3 / 4 · Its proposal, and a preview of it as a web page')
  await wait(3000)
  say('4 / 4 · Tap Approve: the agent can start')
  await wait(1200)
  await tap(await find('#detailView [data-act="status"]', 'Approve'))
  say('Done · Approved, with Undo for a few seconds')
  await wait(2000)
}
export const ApproveAProposal: Story = {
  render: (_, { globals }) => <Player path="/p/shop/" script={approve} scheme={String(globals.scheme)} />,
}
