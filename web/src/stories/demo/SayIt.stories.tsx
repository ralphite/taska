// Demo (T589, D124): say what you want done, Taska writes it out, the organizer files it, and it is in the list. The
// real page on the phone and the desktop, answered by a real server's recorded answers (recordings/sayIt.*.json).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DemoFrames } from './DemoFrames'
import { sayIt } from './demos'

export default { title: 'Demo/Say it, it becomes an item', parameters: { layout: 'fullscreen' } } satisfies Meta

/** Tap through it (the yellow spot shows what to press), or press Play. */
export const PhoneAndDesktop: StoryObj = {
  name: 'Phone and desktop',
  render: (_args, { globals }) => <DemoFrames demo={sayIt} theme={globals.theme === 'dark' ? 'dark' : 'light'} />,
}
