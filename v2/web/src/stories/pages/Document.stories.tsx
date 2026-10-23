// T521: Pages > Document: the page with a document open, in each kind a document comes in; T522: and while its
// address is reloaded, or names a document that is not there (the real page, only Taska answers otherwise)
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Document', parameters: pageParams() }
export default meta

export const WithComments: StoryObj = { ...screen(SHOP + 'D1'), name: 'With comments' }
export const LongWithContents: StoryObj = { ...screen(SHOP + 'D3'), name: 'Long, with contents' }
export const WebPage: StoryObj = { ...screen(SHOP + 'D2'), name: 'Web page' }
export const WithChoices: StoryObj = { ...screen(SHOP + 'D4'), name: 'With choices' }
/** T522: a document's address reloaded while Taska has not answered: the page has no loading state for the
 * document; the desktop shows the New input page and the phone the list, with "Loading…", until it comes. */
export const ReloadStillLoading: StoryObj = {
  ...screen(SHOP + 'D1', undefined, { net: { '^/(p|api)/': 'hang' } }),
  name: 'Reload: still loading',
}
/** T522: the address names a document the project does not have (D99): the desktop says "Select an item or type
 * below" (its address stays D99), the phone shows the list; nothing says the document is not there. */
export const NotThere: StoryObj = { ...screen(SHOP + 'D99'), name: 'Not in this project' }
