// What the box comments on: nothing picked, the whole document, one or several paragraphs, words, a part of a web page.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, one } from '../../stories/composerDocFixtures'

export default { title: 'Components/Input box/Commenting on a document/Picking what to comment on' } satisfies Meta
type Story = StoryObj

/** Nothing picked: the desktop replies on the document's item; the phone comments on the whole document. */
export const NothingPicked = at({ at: 'D1' })
/** The phone, nothing picked: a comment on the whole document (Reply to its item instead). */
export const WholeDocument = at({ at: 'D1' }, { desk: false })
export const OnePicked = at(one)
export const OnePickedWordsInIt: Story = { ...at({ ...one, text: 'Also keep the sort.' }), name: 'One picked, typing' }
export const SeveralPicked = at({ at: 'D1', sel: ['k1', 'k2'] })
export const WordsPicked = at({ at: 'D1', quote: { key: 'k2', text: 'which filter' } })
export const WebPagePartPicked = at({ at: 'D2', quote: { key: 'p1', text: 'Avg. order value' }, text: 'Show it per week.' })
