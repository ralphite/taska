// Demo (T589, D124): an agent proposes a change to one section of the rules; approved, it is the next version, and
// History shows what each version changed. The real page on the phone and the desktop, answered by a real server's
// recorded answers (recordings/rulesChange.*.json).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DemoFrames } from './DemoFrames'
import { rulesChange } from './demos'

export default { title: 'Demo/Approve a change to the rules', parameters: { layout: 'fullscreen' } } satisfies Meta

/** Tap through it (the yellow spot shows what to press), or press Play. */
export const PhoneAndDesktop: StoryObj = {
  name: 'Phone and desktop',
  render: (_args, { globals }) => <DemoFrames demo={rulesChange} theme={globals.theme === 'dark' ? 'dark' : 'light'} />,
}
