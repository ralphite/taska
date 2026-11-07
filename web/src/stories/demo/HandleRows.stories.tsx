// Demo (T589, D124): rows of the list put off to Later, marked won't do and put back with Undo, done. The phone swipes
// them; the desktop opens each and uses the buttons over the item. The real page on the phone and the desktop,
// answered by a real server's recorded answers (recordings/handleRows.*.json).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DemoFrames } from './DemoFrames'
import { handleRows } from './demos'

export default { title: 'Demo/Handle rows in the list', parameters: { layout: 'fullscreen' } } satisfies Meta

/** Tap through it (the yellow spot shows what to press; a swipe needs a touch screen), or press Play. */
export const PhoneAndDesktop: StoryObj = {
  name: 'Phone and desktop',
  render: (_args, { globals }) => <DemoFrames demo={handleRows} theme={globals.theme === 'dark' ? 'dark' : 'light'} />,
}
