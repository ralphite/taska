// T661, a prototype: direction C, list and detail. Under the box, the list at the box's width, each input in two lines
// of its words and one of what it became; beside it, the one picked (the latest at first) whole: all its words, its
// voice note and what was heard word for word, its pictures, what it became, and everything its menu does, at once.
// What it fixes: today a long input takes a screen, and checking or fixing one is a menu and a sheet at a time while
// half of a wide screen stays empty. On the phone the picked one is a page of its own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Back, Desk, DeskPage, Detail, List, Phone, PhonePage, Phones } from './t661Page'

export default { title: 'Prototype/T661 New input page/C List and detail' } satisfies Meta

const Page = ({ picked }: { picked: string }) => (
  <DeskPage wide>
    <div className="mt-8 grid grid-cols-[minmax(0,42rem)_minmax(22rem,1fr)] items-start gap-8">
      <List look="compact" picked={picked} small />
      <aside aria-label="The input picked" className="sticky top-6">
        <Detail id={picked} />
      </aside>
    </div>
  </DeskPage>
)

export const Desktop: StoryObj = {
  name: 'Desktop',
  render: () => (
    <Desk>
      <Page picked="r1027" />
    </Desk>
  ),
}

export const OnThePhone: StoryObj = {
  name: 'On the phone: the list, and one opened',
  render: () => (
    <Phones>
      <Phone label="the list">
        <PhonePage>
          <List look="compact" small />
        </PhonePage>
      </Phone>
      <Phone label="one opened">
        <PhonePage foot={false}>
          <Back />
          <Detail id="r1027" phone />
        </PhonePage>
      </Phone>
    </Phones>
  ),
}

/** The pointer on another row: lit grey; the picked one stays blue. */
export const UnderThePointer: StoryObj = {
  name: 'Under the pointer',
  parameters: { pseudo: { hover: ['[data-pointer] section[aria-label="Today"] article:nth-of-type(3)'] } },
  render: () => (
    <Desk width={1200}>
      <div data-pointer className="[&>div]:min-h-0">
        <Page picked="r1027" />
      </div>
    </Desk>
  ),
}
