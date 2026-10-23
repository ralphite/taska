// T457 (#6481): what the phone does with a swipe. Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, swipe, tap } from './demo'

export default { title: 'Demo/Phone gestures' } satisfies Meta

export const SwipeRightForTheNextStep = demo({
  on: 'phone',
  steps: [swipe('Swipe a row to the right: its natural next step', 'T3', 240)],
  done: 'Done, with Undo',
})

export const SwipeLeftForMore = demo({
  on: 'phone',
  steps: [swipe('Swipe a row to the left', 'T3', -200), tap('Tap Later', 'later', 1)],
  done: 'Put off to Later',
})

export const SwipeBack = demo({
  on: 'phone',
  steps: [
    tap('Open an item', 'T3'),
    { say: 'Swipe right on the page: back to the list', swipe: '#detailView', by: 260 },
  ],
  done: 'Back in the list, where you were',
})
