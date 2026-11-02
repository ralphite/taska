// An item's page once finished: done, won't do, archived.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, message } from '../../stories/fixtures'
import { at, report, said } from '../../stories/itemPageFixtures'

export default { title: 'Components/Item page/By item status/Finished' } satisfies Meta
type Story = StoryObj

export const Done = at({ status: 'done', thread: [said, report], decided: { from: 'review', to: 'done', msg: 6, t: T } })
export const WontDo: Story = { ...at({ status: 'dropped', thread: [said, message({ id: 2, text: 'Not needed: the filter is kept by the new export.' })] }), name: 'Won’t do' }
export const Archived = at({ status: 'done', archived: true, thread: [said, report] })
