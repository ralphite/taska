// T457 (#6481): voice: the words being worked out, what may be misheard, a word put right and remembered, starting
// from anywhere. Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, select, send, sendVoice, speak, tap } from './demo'
import { W } from './words'

export default { title: 'Demo/Voice' } satisfies Meta

const stop = tap('Tap Stop: the words go into the box', 'recStop')

export const WaitForTheWords = demo({
  steps: [...speak(), stop, { say: 'The words are being worked out: a moment' }],
  done: 'The words are in the box, to read before sending',
})

export const PickWhatYouMeant = demo({
  heard: { doubts: [{ was: W.doubtWas, alt: W.doubtAlt, why: W.doubtWhy }] },
  steps: [
    ...speak(),
    stop,
    { say: 'One word may be misheard: both hearings are marked' },
    tap('Tap the one you meant', 'doubt', 1),
  ],
  done: 'The word you meant is in the box',
})

export const PutAWordRightAndKeepIt = demo({
  on: 'phone', // the desktop's New input page offers no Correct on what you said
  steps: [
    ...speak(),
    sendVoice,
    tap('Tap Inputs: what you said', 'inputsTab'),
    select('Select a misheard word in what you sent', W.misheard, 'sentWords'),
    tap('Tap Fix', 'fixWord'),
    { say: 'Write the right word', type: W.meant },
    send,
  ],
  done: 'Put right in what you sent, and remembered for next time',
})

export const StartFromAnywhere = demo({
  on: 'desktop',
  path: '/p/shop/T3',
  steps: [
    { say: 'Press Shift+V on any page: a new input, by voice', key: 'Shift+V' },
    { say: 'Speak', speak: 5 },
    { say: 'Press Shift+V again: sent', key: 'Shift+V' },
  ],
  done: 'Sent as a new input, and you stayed where you were',
})
