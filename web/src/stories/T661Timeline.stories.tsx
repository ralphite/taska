// T661, a prototype: direction B, the timeline. Each day a line down the list with a dot for every input, in the colour
// of where it stands: grey when done, blue while Taska is on it, red or amber when it needs you; the time and number
// in a column beside it; what it became as chips under the words, its voice note at the end of that line; its
// buttons float over its corner under the pointer. What it fixes: today the one that failed or waits looks like the
// thirty that are fine, and is found only by reading every outcome line.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Desk, DeskPage, List, Phone, PhonePage, Phones, Under } from './t661Page'

export default { title: 'Prototype/T661 New input page/B Timeline' } satisfies Meta

export const Desktop: StoryObj = {
  name: 'Desktop',
  render: () => (
    <Desk>
      <DeskPage>
        <Under>
          <List look="rail" />
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
          <div className="px-3">
            <List look="rail" />
          </div>
        </PhonePage>
      </Phone>
    </Phones>
  ),
}

/** The pointer on an input: Comment, Voice and ⋯ float over its top corner, taking no room. */
export const UnderThePointer: StoryObj = {
  name: 'Under the pointer',
  parameters: { pseudo: { hover: ['[data-pointer] section[aria-label="Today"] article:nth-of-type(6)'] } },
  render: () => (
    <Desk width={900}>
      <div data-pointer className="bg-zinc-50 px-8 py-8 dark:bg-zinc-950">
        <Under>
          <List look="rail" />
        </Under>
      </div>
    </Desk>
  ),
}
