// T457 (#6481): what the phone does with a swipe. Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, open, swipe, tap } from './demo'

export default { title: 'Demo/Phone gestures' } satisfies Meta

export const SwipeRightForTheNextStep = demo({
  on: 'phone',
  steps: [swipe('Swipe a row to the right: its natural next step', 'B36', 240)],
  done: 'Marked done, with Undo',
})

export const SwipeLeftForMore = demo({
  on: 'phone',
  steps: [swipe('Swipe a row to the left: more to do with it', 'B36', -200), tap('Tap Later', 'later', 1)],
  done: 'Put off to Later',
})

export const SwipeBack = demo({
  on: 'phone',
  steps: [open.task, swipe('Swipe right on the page: back to the list', 'itemPage', 260)],
  done: 'Back in the list, where you were',
})
