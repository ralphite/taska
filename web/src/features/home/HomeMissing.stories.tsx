// A deleted project, not restored, no such project, out of reach, never listed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { shown } from '../../stories/homeFixtures'

export default { title: 'Components/Home page/Deleted or missing projects' } satisfies Meta
type Story = StoryObj

/** A deleted project's old link: it says so, with Restore. */
export const DeletedProject: Story = { render: () => shown({ gone: { name: 'shop', said: '' } }, 420) }

/** Restore did not work: why. */
export const NotRestored: Story = { render: () => shown({ gone: { name: 'shop', said: 'Connection lost; try again' } }, 420) }

/** A link to a project that never was. */
export const NoSuchProject: Story = { render: () => shown({ none: 'shpo' }, 420) }

/** Taska does not answer: the projects kept from before, and a note. */
export const OutOfReach: Story = { render: () => shown({ away: true }, 420) }

/** Not listed yet, and Taska does not answer. */
export const NeverListed: Story = { render: () => shown({ rows: null, away: true }, 260) }
