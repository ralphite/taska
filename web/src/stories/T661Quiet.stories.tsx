// T661, a prototype: direction A, the quiet list. Today's single column, the box's width, with what each input says
// first: each day said once over its inputs, so a row's first line is its time, its number quieter, its voice note
// beside them (not a line of its own); no heading or search over the list (search is the sidebar's, F479). What it
// fixes: the loudest thing in each row today is its number, and almost every row spends a line on its voice note.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Desk, DeskPage, List, Phone, PhonePage, Phones, Under } from './t661Page'

export default { title: 'Prototype/T661 New input page/A Quiet list' } satisfies Meta

export const Desktop: StoryObj = {
  name: 'Desktop',
  render: () => (
    <Desk>
      <DeskPage>
        <Under>
          <List look="quiet" />
        </Under>
      </DeskPage>
    </Desk>
  ),
}

export const OnThePhone: StoryObj = {
  name: 'On the phone',
  render: () => (
    <Phones>
      <Phone>
        <PhonePage>
          <List look="quiet" />
        </PhonePage>
      </Phone>
    </Phones>
  ),
}

/** The pointer on an input: Comment, Voice and ⋯ at the end of its first line; a long one opened (Less). */
export const UnderThePointer: StoryObj = {
  name: 'Under the pointer',
  parameters: { pseudo: { hover: ['[data-pointer] section[aria-label="Today"] article:nth-of-type(6)'] } },
  render: () => (
    <Desk width={900}>
      <div data-pointer className="bg-zinc-50 px-8 py-8 dark:bg-zinc-950">
        <Under>
          <List look="quiet" opened={['r1026']} />
        </Under>
      </div>
    </Desk>
  ),
}
