// T457 (#6481): the desktop's keys: every key on one sheet, the command palette, moving through the list and acting
// without the mouse. Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { at, demo } from './demo'
import { W } from './words'

export default { title: 'Demo/Keyboard' } satisfies Meta

export const EveryKey = demo({
  on: 'desktop',
  steps: [{ say: 'Press ? : every key on one sheet', key: '?' }],
  done: 'Esc closes it',
})

export const TheCommandPalette = demo({
  on: 'desktop',
  steps: [
    { say: 'Press Cmd K', key: 'Meta+k' },
    { say: 'Type what you want', type: W.search, into: at('paletteField') },
    { say: 'Press Enter', key: 'Enter' },
  ],
  done: 'Found and opened without the mouse',
})

export const WorkThroughTheList = demo({
  on: 'desktop',
  steps: [
    { say: 'Press J: the next item opens', key: 'j' },
    { say: 'J again', key: 'j' },
    { say: 'Press L: to Later', key: 'l' },
    { say: 'Press Z: undo', key: 'z' },
  ],
  done: 'Moved and changed with keys only, with Undo on Z',
})
