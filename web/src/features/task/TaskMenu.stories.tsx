// A task's menu for each kind of task: in progress, done, for later, a subtask, archived, placed first in the queue.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { both } from '../../stories/taskMenuFixtures'

export default { title: 'UI/Task pane/Task menu/By task' } satisfies Meta
type Story = StoryObj

/** In progress, with its subtasks: every action, then its type, priority and status (the phone); rows with their keys
 * (the desktop). Each row's click shows in Actions; the rows that open a next step:
 * [Delete asks again](?path=/story/components-around-the-page-menus-and-sheets-task-menu-its-submenus--delete-asks),
 * [Move to project…](?path=/story/components-around-the-page-menus-and-sheets-move-and-pick--move-to-project),
 * [Put under…](?path=/story/components-around-the-page-menus-and-sheets-move-and-pick--move-task),
 * [What agents see](?path=/story/components-around-the-page-menus-and-sheets-sheets-an-task-what-it-came-from-what-agents-see--what-agents-see),
 * and on the desktop [Status…](?path=/story/components-around-the-page-menus-and-sheets-task-menu-its-submenus--status),
 * [Priority…](?path=/story/components-around-the-page-menus-and-sheets-task-menu-its-submenus--priority),
 * [Type…](?path=/story/components-around-the-page-menus-and-sheets-task-menu-its-submenus--type). */
export const TaskInProgress: Story = { ...both({ n: 1 }), name: 'In progress' }
/** Done: Archive, no Later. */
export const TaskDone: Story = { ...both({ n: 8 }), name: 'Done' }
/** For later: Back to now. */
export const TaskLater: Story = { ...both({ n: 7 }), name: 'For later' }
/** Under another: Put under says which. */
export const Subtask: Story = { ...both({ n: 14 }), name: 'A subtask' }
export const TaskArchived: Story = { ...both({ n: 10 }), name: 'Archived' }
// ---- more states (T636)
export const TaskPlacedFirstInTheQueue: Story = { ...both({ n: 5, rank: 0 }), name: 'Placed first in the queue: Back in order' }
