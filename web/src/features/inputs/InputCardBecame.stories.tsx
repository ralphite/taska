// What the organizer made of an input: a task, words added to one, several tasks, its note beside them or alone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, input } from '../../stories/fixtures'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'UI/Inputs page/Input row/What it became/Filed by the organizer' } satisfies Meta
type Story = StoryObj

const note = (msg: string, f = {}) => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
/** Made into a task: what became of it under the words. */
export const MadeAnTask: Story = { ...one(ONE.made), name: 'Made a task' }
export const AddedToAnTask: Story = { ...one(ONE.added), name: 'Added to a task' }
export const SeveralTasks: Story = { ...one(input({ id: 'r33', t: T, acked: true, touched: [12, 14, 7], text: 'Three things: the filter, the coupon box, and which formats.', org: note('Created T014 · Noted on T012 · Noted on T007') })), name: 'Made several tasks' }
export const NoteBesideTasks: Story = { ...one(input({ id: 'r30', t: T, acked: true, touched: [14], text: 'The coupon box hides behind the keyboard; say so in the plan too.', org: note('Created T014 · Commented on D1') })), name: "The organizer's note beside the tasks" }
export const NoteNoTasks: Story = { ...one(input({ id: 'r31', t: T, acked: true, text: 'Thanks, that looks right.', org: note('No changes needed', { changed: false }) })), name: "The organizer's note, no task changed" }
