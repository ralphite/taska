// T457 (#6481): the side lists: every document, everything that happened (with Undo), and what was deleted. Each
// demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, menu, tap } from './demo'

export default { title: 'Demo/Side lists' } satisfies Meta

const side = (name: string) => [menu, tap(`Tap ${name}`, 'section', name)]

export const EveryDocument = demo({
  steps: [...side('Documents'), tap('Open one', 'docLink', 'D1')],
  done: 'Every document of the project, newest first',
})

export const UndoFromActivity = demo({
  steps: [...side('Activity'), tap('Tap Undo on a change', 'undoChange', 1)],
  done: 'Undone, and the undo is in Activity too',
})

export const BringBackWhatYouDeleted = demo({
  steps: [...side('Deleted'), tap('Tap Restore', 'restoreInput', 1)],
  done: 'It is back, with what it made',
})
