// The Demos (T589): each is a thing you do in Taska from start to end, on the real page, in a phone's frame and a
// desktop's. One list of steps per layout drives all of it: the tour you tap through (the spot on what to press),
// Play, the recording of the server's answers (web/scripts/record-demo.mjs) and the check that plays it to the end
// (web/scripts/check-demos.mjs).

import type { Layout } from '../../app/context'
import story from '../../../.storybook/demo-data/story.json'
import { button, marked, role, row, shows, type Target, type Tour } from '../tour/tour'
import type { Recording } from './replay'
import sayItClip from './sayIt.webm?inline'
import sayItPhone from './recordings/sayIt.phone.json'
import sayItDesk from './recordings/sayIt.desk.json'
import answerPhone from './recordings/answerAndAccept.phone.json'
import answerDesk from './recordings/answerAndAccept.desk.json'
import rulesPhone from './recordings/rulesChange.phone.json'
import rulesDesk from './recordings/rulesChange.desk.json'
import rowsPhone from './recordings/handleRows.phone.json'
import rowsDesk from './recordings/handleRows.desk.json'

export interface Demo {
  id: string
  /** where the page opens */
  start: string
  /** the frame's clock starts here (ms): the demo data's time */
  now: number
  /** what the microphone plays (a data: address); a Demo that says nothing has no microphone */
  clip?: string
  tours: Record<Layout, Tour>
  recordings: Record<Layout, Recording>
}

/** A row's title in the list, by its number: a tap there opens the item. */
const title = (n: number, code: string): Target => ({ css: `[data-n="${n}"] p`, label: `Row ${code}` })

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

// Answer an agent's question (T07, its choices) and accept an agent's finished work (T03): each card stays where it
// is, answered, its buttons where they were (r1003).
const needsYou = button(/^Needs you/, { label: 'Needs you' })
const answerT07 = button('Answer', { within: row(7), label: 'Answer' })
const choice = button(/^两个都提供/, { label: 'A choice' })
const finished = { css: 'section', name: /^Claude Code · worker finished this/, label: 'The finished work' }
const accept = button('Accept', { within: finished, label: 'Accept' })

/** Answer an agent's question, accept an agent's finished work (D124: the second Demo). */
export const answerAndAccept: Demo = {
  id: 'answerAndAccept',
  start: '/p/shop/',
  now: story.now,
  tours: {
    phone: {
      steps: [
        { say: 'Tap Needs you: what waits on you.', target: needsYou, wait: 15000 },
        { say: 'Tap Answer on an agent’s question.', target: answerT07 },
        { say: 'Pick one.', target: choice, pace: 1800 },
        { say: 'Tap Send answer. The card stays where it is.', target: button('Send answer') },
        { say: 'Go back to the list.', target: button('Back'), pace: 2200 },
        { say: 'Open the finished work.', target: title(3, 'T03') },
        { say: 'Read what was done, then tap Accept.', target: accept, pace: 2500 },
      ],
    },
    desk: {
      steps: [
        { say: 'Click Needs you: what waits on you.', target: needsYou, wait: 15000 },
        { say: 'Click Answer on an agent’s question.', target: answerT07 },
        { say: 'Pick one.', target: choice, pace: 1800 },
        { say: 'Click Send answer. The card stays where it is.', target: button('Send answer') },
        { say: 'Open the finished work.', target: title(3, 'T03'), pace: 2200 },
        { say: 'Read what was done, then click Accept.', target: accept, pace: 2500 },
      ],
    },
  },
  recordings: { phone: answerPhone, desk: answerDesk },
}

// An agent proposes a change to one section of the rules; approved, it is the next version; History shows each
// version's change.
const viewChange = button('View changes', { label: 'View' })

/** Approve an agent's change to the rules, then see it in History (D124: the third Demo). */
export const rulesChange: Demo = {
  id: 'rulesChange',
  start: '/p/shop/',
  now: story.now,
  tours: {
    phone: {
      steps: [
        { say: 'Tap View on the proposed change to the rules.', target: viewChange, wait: 15000 },
        { say: 'Read the change, then tap Approve.', target: button('Approve'), pace: 2500 },
        { say: 'Close it: the rules have the new version.', target: button('Close'), pace: 2000 },
        { say: 'Tap History.', target: button('History') },
        { say: 'Tap the new version to see what it changed.', target: button(/v3\s*[+−]/, { label: 'Version 3' }), pace: 1800 },
      ],
    },
    desk: {
      steps: [
        { say: 'Click View on the proposed change to the rules.', target: viewChange, wait: 15000 },
        { say: 'Read the change, then click Approve.', target: button('Approve'), pace: 2500 },
        { say: 'Back to the rules: the new version.', target: button('Back to Rules'), pace: 2000 },
        { say: 'Click History: each version and what it changed.', target: button('History') },
        { say: 'Click an earlier version to see its change.', target: button(/v2\s*[+−]/, { label: 'Version 2' }), pace: 2200 },
      ],
    },
  },
  recordings: { phone: rulesPhone, desk: rulesDesk },
}

// Rows of the list: Later (F37), Won't do (T38) and Undo, Done (T40). The phone swipes them; the desktop opens each and
// uses the buttons over the item (the row's own buttons show only under the pointer).
const swipeRow = (n: number, code: string) => marked('swipe', n, { label: `Row ${code}` })
const pane = marked('part', 'pane', { label: 'The item' })
const nextWeek = button(/^Next week/, { label: 'Next week' })

/** Handle rows of the list: Later, Won't do, Undo, Done (D124: the fourth Demo). */
export const handleRows: Demo = {
  id: 'handleRows',
  start: '/p/shop/',
  now: story.now,
  tours: {
    phone: {
      steps: [
        { say: 'Swipe a row left for more.', target: swipeRow(37, 'F37'), swipe: 'left', until: shows(button('Later', { within: row(37) })), wait: 15000 },
        { say: 'Tap Later.', target: button('Later', { within: row(37) }) },
        { say: 'Pick when it comes back.', target: nextWeek },
        { say: 'Swipe another row left.', target: swipeRow(38, 'T38'), swipe: 'left', until: shows(button("Won't do", { within: row(38) })), pace: 1800 },
        { say: 'Tap Won’t do.', target: button("Won't do", { within: row(38) }) },
        { say: 'Changed your mind? Tap Undo.', target: button('Undo'), pace: 1500 },
        { say: 'Swipe a row right: Done.', target: swipeRow(40, 'T40'), swipe: 'right', until: shows(role('status', /T40 is done/, { label: 'Done' })), pace: 1800 },
      ],
    },
    desk: {
      steps: [
        { say: 'Click a row to open it.', target: title(37, 'F37'), wait: 15000 },
        { say: 'Click Later.', target: button('Later', { within: pane }) },
        { say: 'Pick when it comes back.', target: nextWeek },
        { say: 'Open another row.', target: title(38, 'T38'), pace: 1500 },
        { say: 'Click Won’t do.', target: button("Won't do", { within: pane }) },
        { say: 'Changed your mind? Click Undo.', target: button('Undo'), pace: 1500 },
        { say: 'Open one more.', target: title(40, 'T40'), pace: 1500 },
        { say: 'Click Done.', target: button('Done', { within: pane }) },
      ],
    },
  },
  recordings: { phone: rowsPhone, desk: rowsDesk },
}

export const DEMOS: Record<string, Demo> = { sayIt, answerAndAccept, rulesChange, handleRows }
