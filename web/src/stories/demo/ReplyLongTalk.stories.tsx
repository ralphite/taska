// Demo (T786 r1337): answer an agent's question by voice at the end of a long talk, as on system-design T27 on
// Yadong's iPhone; the words come, the agent replies with its next question. The real page on the phone and the
// desktop, answered by a real server's recorded answers (recordings/replyLongTalk.*.json).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DemoFrames } from './DemoFrames'
import { replyLongTalk } from './demos'

export default { title: 'Demo/Reply by voice on a long talk', parameters: { layout: 'padded' } } satisfies Meta

/** Watch the talk: it stays at its end as you send, as your words come and as the tutor's next question arrives; it
 * never jumps back. Tap through it (the yellow spot shows what to press), or press Play. */
export const PhoneAndDesktop: StoryObj = {
  name: 'Phone and desktop',
  render: (_args, { globals }) => <DemoFrames demo={replyLongTalk} theme={globals.theme === 'dark' ? 'dark' : 'light'} />,
}
