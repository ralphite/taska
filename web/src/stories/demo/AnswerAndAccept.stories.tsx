// Demo (T589, D124): answer an agent's question and accept an agent's finished work; each card stays where it is,
// answered, its buttons where they were. The real page on the phone and the desktop, answered by a real server's
// recorded answers (recordings/answerAndAccept.*.json).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DemoFrames } from './DemoFrames'
import { answerAndAccept } from './demos'

export default { title: 'Demo/Answer an agent, accept its work', parameters: { layout: 'fullscreen' } } satisfies Meta

/** Tap through it (the yellow spot shows what to press), or press Play. */
export const PhoneAndDesktop: StoryObj = {
  name: 'Phone and desktop',
  render: (_args, { globals }) => <DemoFrames demo={answerAndAccept} theme={globals.theme === 'dark' ? 'dark' : 'light'} />,
}
