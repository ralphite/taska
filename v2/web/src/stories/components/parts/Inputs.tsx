// T457: what you said (inputs): the Inputs tab, one input in each state it can be in, and the New input page's list.
// B555: each story is the real page at an address, after Yadong's steps there (an agent or the organizer writing to
// the real Taska server in the page when the steps change something), showing that part of it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { looksOf, place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'InputsView',
      'InputCard',
      'NotHandled',
      'OutboxRows',
      'OutboxStep',
      'SaidLately',
      'SaidStep',
      'SaidRow',
      'TakeBack',
      'ComposeHead',
      'DraftCard',
    ],
  },
}
export type Story = StoryObj

const INPUTS = '/p/shop/inputs'
/** The Inputs tab, on the phone (the desktop has no Inputs tab: G I and /inputs open the New input page). */
const TAB = ['#mainHead', '#tabs', '#inputsView', '#foot']
const tab = (more: Partial<Twin> = {}): Story => place({ at: INPUTS, part: TAB, ...more }, 'phone')
// a new input, written under the list and sent: the demo's next one, #22
const NEW =
  '\u7ed3\u8d26\u9875\u7684\u4f18\u60e0\u5238\u8f93\u5165\u6846\u5728\u624b\u673a\u4e0a\u88ab\u952e\u76d8\u6321\u4f4f\u4e86\u3002' // the coupon field is under the keyboard on the phone
const say = (words = NEW): Do[] => [{ type: words, into: '#text' }, { click: '#sendBtn[data-act="send"]' }]
const OP = '^/p/shop/api/op'
export const InputsTab = tab()
export const InputsTabSearch = tab({ at: INPUTS + '?q=\u5bfc\u51fa' })
/** Just sent, Taska not answering yet: on its way, first. */
export const InputsTabWithOneOnItsWay = tab({ steps: say(), net: { [OP]: 'hang' } })
export const InputsTabEmpty = tab({ at: '/p/website/inputs' })

/** One input, as a row of the phone's Inputs tab draws it (the only place an input is drawn this way: on the desktop
 * what you said is under New input, F347), after these steps. */
const card = (r: string, more: Partial<Twin> = {}): Story =>
  place({ at: INPUTS, part: `#inputsView article[data-r="${r}"]`, ...more }, 'phone')
const more = (r: string, pick: string): Do[] => [
  { click: `#inputsView [data-act="input-more"][data-id="${r}"]` },
  { click: `#dlgBody [data-act="input-pick"][data-pick="${pick}"]` },
]
/** #19, with its screenshot: no agent has read it yet. */
export const WaitingForYourAgent = card('r19')
export const VoiceNote = card('r20')
/** Said into the box's mic and sent while the speech model still works out its words. */
export const Transcribing = card('r22', {
  steps: [{ click: '#sendBtn[data-act="mic"]' }, { wait: 2500 }, { click: '#sendBtn[data-act="rec-send"]' }],
  heard: { working: true },
})
/** Made into an item: what became of it under your words (#15, B36 with two screenshots). */
export const MadeAnItem = card('r15')
export const AddedToAnItem = card('r3')
/** The organizer left it for your coding agent (its model said pass). */
const left: Do[] = [...say(), { organize: 'pass' }]
export const LeftForYourAgent = card('r22', { steps: left })
/** Left for your agent, and your agent has taken it. */
export const HandledByYourAgent = card('r22', { steps: [...left, { agent: 'ack r22' }] })
/** Your agent read #19 and took it, with no item made. */
export const SeenByYourAgent = card('r19', { steps: [{ agent: 'ack r19' }] })
/** The organizer's commands failed (it named an item the project does not have). */
export const OrganizerFailed = card('r22', {
  steps: [...say(), { organize: 'B99 say \u4f18\u60e0\u5238\u8f93\u5165\u6846\u88ab\u6321\u4f4f\u4e86' }],
})
/** Filed as a new bug, then Undo on the line after sending: what the organizer did is taken back. */
export const Undone = card('r22', {
  steps: [
    ...say(),
    { organize: 'new bug P1 now \u4f18\u60e0\u5238\u8f93\u5165\u6846\u88ab\u952e\u76d8\u6321\u4f4f' },
    { click: '#feedback [data-act="undo"]' },
  ],
})
/** Changed after sending (Edit, new words, Save): when, and the earlier words a tap away. */
export const Edited = card('r19', {
  steps: [
    ...more('r19', 'input-edit'),
    {
      type: '\u8ba2\u5355\u9875\u5217\u8868\u5f88\u957f\u7684\u65f6\u5019\u6eda\u52a8\u5f88\u5361\u3002',
      into: '#text',
    },
    { click: '#sendBtn[data-act="send"]' },
  ],
})
export const MovedToAnotherProject = card('r19', {
  steps: [...more('r19', 'move-input'), { click: '#dlgBody [data-act="move-input-to"][data-to="mobile-app"]' }],
})
/** Your answer to T07's question, sent from its card: an input of its own, an answer. */
export const AnAnswer = card('r22', {
  at: '/p/shop/T7',
  steps: [
    { click: '[data-act="choice"][data-n="7"][data-i="0"]' },
    { click: '[data-act="choice-send"][data-n="7"]' },
    { wait: 1000 },
    { click: '#backBtn' },
    { click: '#tabs [data-tab="inputs"]' },
  ],
})

/** What is still on its way, first where your inputs are listed: two sent while Taska is out of reach (they go by
 * themselves when it answers). */
export const OnItsWay = place(
  {
    at: INPUTS,
    steps: [...say(), ...say('\u987a\u4fbf\u628a\u5bfc\u51fa\u6309\u94ae\u6539\u6210\u84dd\u8272')],
    net: { [OP]: 'down' },
    part: ['#inputsView > article:nth-child(1)', '#inputsView > article:nth-child(2)'],
  },
  'phone', // the desktop lists them under You said lately, on the New input page
)

/** The New input page (desktop): what you said lately, under the box. */
export const SaidLatelyList = place({ at: '/p/shop/', part: '#composeList' }, 'desktop')
// T522 (r731, r762): a line of what you said lately under the pointer (its time gives way to Add more and ⋯), from the
// keys, its buttons pointed at, side by side; the desktop only.
const LINE = '#composeList li:nth-child(1 of [class~="group/row"])'
export const SaidLooks: Story = looksOf({ at: '/p/shop/', part: LINE }, [
  { name: 'As it is' },
  { name: 'Pointer on a line: Add more and \u22ef show', hover: LINE },
  { name: 'Keys: Tab on its item', focus: `${LINE} button[data-act="goto"]` },
  { name: 'Pointer on its item', part: [LINE, '#tip'], hover: `${LINE} button[data-act="goto"]` },
  { name: 'Pointer on its \u22ef', part: [LINE, '#tip'], hover: `${LINE} [data-act="input-more"]` },
])
/** The project's name over the New input page (desktop). */
export const ProjectHead = place({ at: '/p/shop/', part: '#composeHead' }, 'desktop')
