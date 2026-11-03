// T661, a prototype: the New input page as it is today, with the same data as the three directions beside it
// (stories/t661Page.tsx), to compare them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Desk, DeskPage, List, Under } from './t661Page'

export default { title: 'Prototype/T661 New input page/Today' } satisfies Meta

/** The page as it is: Inputs with how many and its search over the list; each input's number and day, its words, its
 * voice note on a line of its own, what it became. */
export const AsItIsToday: StoryObj = {
  name: 'As it is today',
  render: () => (
    <Desk>
      <DeskPage>
        <Under>
          <List />
        </Under>
      </DeskPage>
    </Desk>
  ),
}
