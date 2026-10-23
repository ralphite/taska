// T457 (#6481): saying something new to Taska, by voice or in writing, and what happens to it after: each demo is
// its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, only, send, sendVoice, speak, tap, undo, write, type Name } from './demo'
import { W } from './words'

export default { title: 'Demo/New input' } satisfies Meta

const filed = (plan: string) => ({ say: 'The organizer files it', organize: plan })
/** What you said: the phone has it under Inputs, the desktop on the New input page; then an input's menu. */
const yourInput = (pick: Name, what: string) => [
  only('phone', tap('Tap Inputs: everything you said', 'inputsTab')),
  tap('Tap ... on the newest one', 'inputMore', 1),
  tap(what, pick),
]

export const WriteANewInput = demo({
  steps: [
    write('Write what you want, in your own words', W.newInput),
    tap('Tap Send: the box is empty at once, for the next thought', 'send'),
    filed(`new feature P2 now ${W.newInputTitle}\n  ${W.newInput}`),
  ],
  done: 'It became a new feature, in your words',
})

export const SayANewInput = demo({
  steps: [...speak(), sendVoice, filed(`F1 say ${W.orgF1}`)],
  done: 'Your voice note and its words went to the export feature it is about',
})

export const SayThenFixTheWords = demo({
  steps: [
    ...speak(),
    tap('Tap Stop: the words go into the box', 'recStop'),
    write('Add a few words by hand', W.voiceMore),
    send,
  ],
  done: 'Sent: the voice note with its words, and what you added',
})

export const DiscardARecording = demo({
  steps: [...speak(), tap('Not what you meant? Tap the bin', 'recCancel')],
  done: 'Nothing was sent: the box is as before',
})

export const VoiceWithTheKeyboard = demo({
  on: 'desktop',
  steps: [
    { say: 'Press V: it listens', key: 'v' },
    { say: 'Speak', speak: 5 },
    { say: 'Press Enter: the words go into the box', key: 'Enter' },
    { say: 'Press Shift+Enter: sent', key: 'Shift+Enter' },
  ],
  done: 'Sent without touching the mouse',
})

export const CancelWithEscape = demo({
  on: 'desktop',
  steps: [
    { say: 'Press V: it listens', key: 'v' },
    { say: 'Speak', speak: 3 },
    { say: 'Press Esc', key: 'Escape' },
  ],
  done: 'The recording is gone: nothing was sent',
})

export const SendAPicture = demo({
  steps: [
    { say: 'Paste a screenshot into the box', paste: 'p__shop__f__f4-shot-cart.png' },
    write('Say what is wrong in it', W.picture),
    send,
    filed(`B36 say ${W.orgB36}`),
  ],
  done: 'The picture and your words are on the bug they are about',
})

export const AddMoreToWhatYouSaid = demo({
  steps: [...yourInput('inputAddMore', 'Tap Add more'), write('Write what you forgot', W.addToR21), send],
  done: 'It is added to what you said, and the agent sees it',
})

export const EditWhatYouSaid = demo({
  steps: [
    ...yourInput('inputEdit', 'Tap Edit: your words come back into the box'),
    write('Change them', W.editR21),
    send,
  ],
  done: 'Your input says the new words; its history keeps the old ones',
})

export const DeleteWhatYouSaidThenUndo = demo({
  steps: [...yourInput('inputDelete', 'Tap Delete: with the items only it made'), undo],
  done: 'It is back, as it was',
})

export const PutWhatYouSaidWithAnItem = demo({
  steps: [
    ...yourInput('inputWithItem', 'Tap Put with another item'),
    tap('Pick the item it is about', 'withItem', 'T15'),
  ],
  done: 'It now goes with T15',
})

export const MoveWhatYouSaidToAnotherProject = demo({
  steps: [
    ...yourInput('inputMove', 'Tap Move to: sent to the wrong project?'),
    tap('Pick the project it belongs to', 'toProject', 'Mobile app'),
  ],
  done: 'It went to Mobile app, with what it made',
})
