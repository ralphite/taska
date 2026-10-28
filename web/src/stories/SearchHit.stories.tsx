// Searched words marked (T591: Icons and marks > Search hit): the page's own Hit in a title and in the words of a
// message, every word of the search, wherever it is.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { searchWords } from '../model/visible'
import { Hit } from '../ui/bits'
import { Frames } from './Frames'

export default { title: 'Components/Icons and marks/Search hit' } satisfies Meta
type Story = StoryObj

const words = searchWords('export filter')
export const Marked: Story = {
  name: 'Searched words marked',
  render: () => (
    <Frames phoneWidth={393} deskWidth={480}>
      {() => (
        <div className="flex flex-col gap-2 p-3 text-[15px]">
          <Hit text="Export ignores the active filter" words={words} />
          <Hit text="The exported file keeps the filters you set, and the sort." words={words} />
          <Hit text="Nothing here matches." words={words} />
        </div>
      )}
    </Frames>
  ),
}
