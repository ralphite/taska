// T457: the real page, played by itself: what a person does, step by step, with each tap shown (R488). Demo is in
// folders by what you do (D68); this file is Needs you: approve what an agent proposes, answer what it asks. Each on
// the phone and, where the desktop shows it its own way, on the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Script } from '../lib/player'
import { end, first, look, tap } from './steps'

const meta: Meta = {
  title: 'Demo/Needs you',
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
  // the frame fits the room Storybook has, with the line and the buttons under it in sight: the preview fills the
  // canvas (no fixed 1440x900 preview, wider than the canvas, that put the phone off to one side)
  globals: { viewport: { value: '100pct-100pct', isRotated: false } },
}
export default meta
type Story = StoryObj

/** Find what needs you, open the agent's proposal, read it, approve it. */
const approve: Script = async (c) => {
  await first(c, 'Items \u00b7 what needs you is in amber')
  await tap(c, 'Items \u00b7 tap Needs you: just those', '[data-act="set-filter"][data-v="wait"]')
  await tap(c, 'Needs you \u00b7 tap the idea I04', '#list [data-act="open"][data-n="4"]')
  await look(c, 'I04 \u00b7 read what the agent proposes', 3200)
  await tap(c, 'I04 \u00b7 tap Approve: the agent starts', '#detailView [data-act="status"]', 'Approve')
  await end(c, 'Approved, with Undo for a moment')
}
export const ApproveAProposal: Story = {
  name: 'Approve a proposal \u00b7 phone',
  render: (_, { globals }) => <Player path="/p/shop/" script={approve} scheme={String(globals.scheme)} />,
}
export const ApproveAProposalOnTheDesktop: Story = {
  name: 'Approve a proposal \u00b7 desktop',
  render: (_, { globals }) => <Player path="/p/shop/" script={approve} scheme={String(globals.scheme)} on="desktop" />,
}

/** Answer an agent's question from the list: its card comes up over the list, pick, send. */
const answer: Script = async (c) => {
  await first(c, 'Items \u00b7 what needs you is in amber')
  await tap(c, 'Items \u00b7 tap Needs you: just those', '[data-act="set-filter"][data-v="wait"]')
  await tap(c, 'Needs you \u00b7 tap Answer on T07', '[data-act="row-act"][data-n="7"]')
  await look(c, 'T07 \u00b7 the agent asks: which format?', 3000)
  await tap(c, 'T07 \u00b7 tap Excel (.xlsx)', '[data-act="choice"]', '.xlsx')
  await tap(c, 'T07 \u00b7 tap Send answer', '[data-act="choice-send"]')
  await end(c, 'Answered \u00b7 T07 leaves Needs you')
}
export const AnswerAQuestion: Story = {
  name: 'Answer a question \u00b7 phone',
  render: (_, { globals }) => <Player path="/p/shop/" script={answer} scheme={String(globals.scheme)} />,
}
