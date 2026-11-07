// The Demos (T589): each is a thing you do in Taska from start to end, on the real page, in a phone's frame and a
// desktop's. One list of steps per layout drives all of it: the tour you tap through (the spot on what to press),
// Play, the recording of the server's answers (web/scripts/record-demo.mjs) and the check that plays it to the end
// (web/scripts/check-demos.mjs).

import type { Layout } from '../../app/context'
import story from '../../../.storybook/demo-data/story.json'
import { button, role, shows, type Tour } from '../tour/tour'
import type { Recording } from './replay'
import sayItClip from './sayIt.webm?inline'
import sayItPhone from './recordings/sayIt.phone.json'
import sayItDesk from './recordings/sayIt.desk.json'

export interface Demo {
  id: string
  /** where the page opens */
  start: string
  /** the frame's clock starts here (ms): the demo data's time */
  now: number
  /** what the microphone plays (a data: address) */
  clip: string
  tours: Record<Layout, Tour>
  recordings: Record<Layout, Recording>
}

// what the organizer makes of the words (sayIt.json)
const TITLE = /导出的日期用设置里选的格式/
const filed = role('status', /^Created T\d+/, { label: 'Created' })

/** Say it, the organizer files it, it is in the list (D124: the first Demo; voice, the organizer and the page waiting
 * for news are all in it). */
export const sayIt: Demo = {
  id: 'sayIt',
  start: '/p/shop/',
  now: story.now,
  clip: sayItClip,
  tours: {
    phone: {
      steps: [
        { say: 'Tap the mic to say what you want done.', target: button('Record a voice note'), wait: 15000, pace: 1500 },
        { say: 'Say it (here a recording plays), then tap ↑ to send it.', target: button('Stop and send'), pace: 6000 },
        { say: 'Taska writes out your words; the organizer files them.', until: shows(filed) },
        { say: 'Tap Open to see the new item.', target: button('Open', { within: filed }), pace: 2000 },
      ],
    },
    desk: {
      steps: [
        { say: 'Click the mic to say what you want done.', target: button('Record a voice note'), wait: 15000, pace: 1500 },
        { say: 'Say it (here a recording plays), then click ↑ to send it.', target: button('Stop and send'), pace: 6000 },
        { say: 'Taska writes out your words; the organizer files them.', until: shows(button(TITLE, { label: 'The new item' })) },
        { say: 'Click the new item to open it.', target: button(TITLE, { label: 'The new item' }), pace: 2000 },
      ],
    },
  },
  recordings: { phone: sayItPhone, desk: sayItDesk },
}

export const DEMOS: Record<string, Demo> = { sayIt }
