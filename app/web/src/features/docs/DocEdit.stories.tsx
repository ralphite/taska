import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { DocEdit } from './DocEdit'

const meta: Meta = { title: 'Components/Document/Editor' }
export default meta
type Story = StoryObj

const on = { change() {}, discard() {}, save() {}, mic() {} }

/** Editing a document (the first line is its title), a new one empty, and speaking into it. */
export const Editor: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Frames height={420}>{(layout) => <div className="h-full px-6 pt-4"><DocEdit isNew={false} text={'# The rewrite plan\n\nThe new page is written from scratch.'} hint={layout === 'desk' ? 'First line is the title. Esc keeps it as a draft.' : 'The first line is the title.'} mic={{ on: false, text: 'Speak' }} on={on} /></div>}</Frames>
      <Frames height={320}>{() => <div className="h-full px-6 pt-4"><DocEdit isNew text="" hint="Listening. Words go at the mark; you can keep typing." mic={{ on: true, text: 'Stop 0:07' }} on={on} /></div>}</Frames>
    </div>
  ),
}
