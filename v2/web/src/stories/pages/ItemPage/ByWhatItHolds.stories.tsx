// T521: Pages > Item page > By what it holds: the page with an item open that has subitems and a document, is a
// subitem, has pictures, a long talk, or very long words
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LONG_T3, SHOP, pageParams, screen } from '../screens'

const meta: Meta = { title: 'Pages/Item page/By what it holds', parameters: pageParams() }
export default meta

/** A parent: its subitems, its plan document, two agents at work. */
export const WithSubitemsAndDocument: StoryObj = { ...screen(SHOP + 'T12'), name: 'With subitems and a document' }
export const Subitem: StoryObj = { ...screen(SHOP + 'T13'), name: 'Subitem' }
export const WithPictures: StoryObj = { ...screen(SHOP + 'B36'), name: 'With pictures' }
/** A long talk (18 messages), the item finished. */
export const LongTalk: StoryObj = { ...screen(SHOP + 'B35'), name: 'Long talk' }
/** T522: a very long title and long details, with an address in them that has no room to break. */
export const VeryLong: StoryObj = {
  ...screen(SHOP + 'T3', undefined, { items: LONG_T3 }),
  name: 'Very long title and details',
}
