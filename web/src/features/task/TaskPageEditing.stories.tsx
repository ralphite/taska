// A task's page as you change it: editing its words, adding a subtask (the first one too), your reply on its way.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PARENT } from '../../stories/taskPage'
import { talkShow } from '../../stories/fromYouFixtures'
import { at } from '../../stories/taskPageLayoutFixtures'

export default { title: 'UI/Task pane/Whole/Editing and replying' } satisfies Meta
type Story = StoryObj

export const Editing: Story = { ...at({ f: { editing: true } }), name: 'Editing its title and words' }
export const AddingASubtask: Story = { ...at({ f: { addingSub: true } }), name: 'Adding a subtask' }
/** adding the first subtask of a task with none: the Subtasks head with no count, only the field */
export const AddingTheFirstSubtask: Story = { ...at({ others: [PARENT], f: { addingSub: true } }), name: 'Adding the first subtask' }
/** on its way: × cancels it (it is not sent) */
export const YourReplyOnItsWay: Story = { ...at({ t: { outgoing: [{ q: 'q1', text: 'Also keep the sort.', show: talkShow('sending') }] } }), name: 'Your reply on its way' }
