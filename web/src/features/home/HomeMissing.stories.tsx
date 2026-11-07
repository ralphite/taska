// A deleted project, not restored, no such project, out of reach, never listed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { shown } from '../../stories/homeFixtures'

export default { title: 'UI/Home page/Deleted or missing projects' } satisfies Meta
type Story = StoryObj

/** A deleted project's old link: it says so, with Restore. */
export const DeletedProject: Story = { name: 'A deleted project', render: () => shown({ gone: { name: 'shop', said: '' } }, 420) }

/** Restore did not work: why. */
export const NotRestored: Story = { name: 'Not restored', render: () => shown({ gone: { name: 'shop', said: 'Not restored: its folder is gone' } }, 420) }

/** A link to a project that never was. */
export const NoSuchProject: Story = { name: 'No such project', render: () => shown({ none: 'shpo' }, 420) }

/** Taska does not answer: the projects kept from before, and a note. */
export const OutOfReach: Story = { name: 'Taska out of reach', render: () => shown({ away: true }, 420) }

/** Not listed yet, and Taska does not answer. */
export const NeverListed: Story = { name: 'Never listed', render: () => shown({ rows: null, away: true }, 260) }
