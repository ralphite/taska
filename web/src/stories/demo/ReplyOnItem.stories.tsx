// Demo (T589, D124): reply to Claude Code on the item it works on, typed and then said; its replies come. The real
// page on the phone and the desktop, answered by a real server's recorded answers (recordings/replyOnItem.*.json).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DemoFrames } from './DemoFrames'
import { replyOnItem } from './demos'

export default { title: 'Demo/Reply to an agent', parameters: { layout: 'fullscreen' } } satisfies Meta

/** Tap through it (the yellow spot shows what to press), or press Play. */
export const PhoneAndDesktop: StoryObj = {
  name: 'Phone and desktop',
  render: (_args, { globals }) => <DemoFrames demo={replyOnItem} theme={globals.theme === 'dark' ? 'dark' : 'light'} />,
}
