// T457 (#6481): changing an item: its status, priority, type, when; archive, subitems, edit, move, delete. Each demo
// is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, only, openMenu as menu, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Items' } satisfies Meta

const task = tap('Tap a task to open it', 'T3')
const status = tap('Tap its status', 'statusPill')

export const MarkItDone = demo({
  steps: [task, only('phone', status), tap('Tap Done', 'done')],
  done: 'Done, with Undo for a few seconds',
})

export const ChangeItsStatus = demo({
  steps: [task, status, tap('Pick In progress', 'inProgress')],
  done: 'In progress',
})

export const ChangeItsPriority = demo({
  steps: [task, tap('Tap its priority', 'priorityPill'), tap('Pick P1', 'p1')],
  done: 'It is P1 now: it moves up in the list',
})

export const ChangeItsType = demo({
  steps: [task, tap('Tap its type', 'typePill'), tap('It is really a bug', 'bug')],
  done: 'A bug now, with a B code; the old code still finds it',
})

export const SayWontDo = demo({
  steps: [task, status, tap("Pick Won't do", 'dropped')],
  done: "Won't do: closed without doing it",
})

export const PutItOffThenBackToNow = demo({
  steps: [task, tap('Tap Later: off the active list', 'later', 1), tap('Tap Later again: back to now', 'later', 1)],
  done: 'Back to now',
})

export const ArchiveThenUndo = demo({
  steps: [
    tap('Finished: what is done', 'finished'),
    tap('Open one', 'B35'),
    only('phone', menu),
    tap('Tap Archive: put it away', 'archive'),
    tap('Tap Undo', 'toastUndo'),
  ],
  done: 'It is back where it was',
})

export const DoThisNext = demo({
  steps: [task, menu, tap('Tap Do this next: first of its priority in the queue', 'doNext')],
  done: 'The agents take it next',
})

export const AddASubitem = demo({
  steps: [
    task,
    menu,
    tap('Tap Add subitem', 'addSubitem'),
    write('Name it', W.subT3, 'subTitle'),
    tap('Tap Add', 'subAdd'),
  ],
  done: 'The subitem is under it, in the list too',
})

export const EditItsWords = demo({
  steps: [
    task,
    menu,
    tap('Tap Edit', 'edit'),
    write('Add what is new to its text', W.editT3, 'editBody'),
    tap('Tap Save', 'editSave'),
  ],
  done: 'Saved; agents see the new words',
})

export const PutItUnderAnotherItem = demo({
  steps: [task, menu, tap('Tap Put under', 'putUnder'), tap('Pick the item it belongs to', 'under', 'T15')],
  done: 'It is a subitem of T15 now',
})

export const MoveItToAnotherProject = demo({
  steps: [task, menu, tap('Tap Move to project', 'moveItem'), tap('Pick the project', 'itemTo', 'Mobile app')],
  done: 'It went to Mobile app with its talk and documents; here it says where',
})

export const DeleteThenUndo = demo({
  steps: [
    task,
    menu,
    tap('Tap Delete', 'deleteItem'),
    { ...tap('Tap it again to be sure', 'deleteItem'), soon: true },
    tap('Tap Undo', 'toastUndo'),
  ],
  done: 'It is back; deleted items wait in Deleted too',
})
