// A document's editor, one story for each state (T591: the groups and names Yadong had before the rewrite): the
// page's own editFacts and DocEdit, where it is read on the desktop and in a sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { noteText } from '../../model/docs'
import { Frames } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { editAt } from '../../stories/docPage'

export default { title: 'Components/Document/Editing' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const one = (isNew: boolean, f: Parameters<typeof editAt>[3] = {}): Story => ({ render: () => <Frames height={560} deskWidth={900} phoneWidth={393}>{(layout) => editAt(isNew ? null : PLAN, isNew ? '' : noteText(PLAN), layout === 'desk', f)}</Frames> })

/** Its text, the first line its title, with Speak, Discard and Save. */
export const Editing: Story = { ...one(false), name: 'Editor' }
export const NewDocument: Story = { ...one(true), name: 'New document' }
/** Speak pressed: words go where the caret is, and typing goes on. */
export const Listening: Story = { ...one(false, { rec: { ms: 7000 } }), name: 'Speaking into it' }
export const WorkingOutWords: Story = { ...one(false, { waiting: 1 }), name: 'Working out the words said' }
