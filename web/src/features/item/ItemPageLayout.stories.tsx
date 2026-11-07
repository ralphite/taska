// An item's page as you lay it out: full width, two columns (a document or a web page on the left), the lines between
// its parts that you drag. The page's own pane and ItemPage.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { WEB, doc } from '../../stories/docFixtures'
import { docAt } from '../../stories/docPage'
import { at, desk } from '../../stories/itemPageLayoutFixtures'

export default { title: 'UI/Item pane/Layout' } satisfies Meta
type Story = StoryObj

export const FullWidth: Story = { ...desk({ full: true }, 1400), name: 'Full width' }
export const TwoColumns: Story = { ...desk({ duo: true }, 1400), name: 'Two columns: the item, its talk beside it' }
/** two columns with a document opened: the document on the left, its item's talk on the right, in the document's pane
 * (its bar: Back to the item, Copy, Edit, Move, Delete) */
export const TwoColumnsDocumentLeft: Story = { ...desk({ duo: true, doc: doc(), left: docAt(doc(), true, { viewOnly: true }) }, 1400), name: 'Two columns: a document on the left' }
/** the same with a web page: no margins around it */
export const TwoColumnsWebPageLeft: Story = { ...desk({ duo: true, bare: true, doc: WEB, left: docAt(WEB, true, { viewOnly: true }) }, 1400), name: 'Two columns: a web page on the left' }
/** the line between the item and its talk under the pointer: drag it up or down */
export const LinePointerOnIt: Story = { ...at({}), name: 'The line above its talk: pointer on it', parameters: { pseudo: { hover: ['[data-grip="top"]'] } } }
