// B629: three ideas of what the list of inputs is for, to pick from (the Inputs tab on the phone, the list under New
// input on the desktop). Each answers its own question: what did my words turn into (1), what exactly did I say (2),
// has what I asked for been done (3). The same inputs in each (b629/inputsDemo: typed, spoken, with pictures, long;
// made one item or two, added to one, an answer, left for an agent, handled by one, moved away, organizing, could not
// be organized, organizing undone, being transcribed), in the same words, drawn with the page's own parts (the item's
// status mark, the voice note's chip, the pictures). The search field works; a long input opens with More.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { Frames } from './Frames'
import { ByWhatItBecame } from './b629/ByWhatItBecame'
import { FollowUp } from './b629/FollowUp'
import { Notebook } from './b629/Notebook'

export default { title: 'Prototype/B629 Inputs list', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const both = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => (
    <Frames deskWidth={900} height={852}>
      {(layout) => <div className={layout === 'desk' ? 'h-full overflow-y-auto px-8 py-6' : 'h-full'}>{draw(layout === 'desk')}</div>}
    </Frames>
  ),
})

/** 1. By what it became: each item an input made or went into heads a group of those inputs; left for an agent,
 * handled by one, moved away: groups of their own; not organized yet: first. */
export const ByWhatItBecameList: Story = { ...both((desk) => <ByWhatItBecame desk={desk} />), name: '1 By what it became' }
/** 2. A notebook: the words first, as one document; what became of each a note in the margin. */
export const NotebookList: Story = { ...both((desk) => <Notebook desk={desk} />), name: '2 A notebook of what I said' }
/** 3. Has it been done: each input with a track from said, to where it went, to done. */
export const FollowUpList: Story = { ...both((desk) => <FollowUp desk={desk} />), name: '3 Has it been done' }

/** Each version searching ("订单"), and finding nothing. */
export const ByWhatItBecameSearch: Story = { ...both((desk) => <ByWhatItBecame desk={desk} q0="订单" />), name: '1 By what it became: searching' }
export const NotebookSearch: Story = { ...both((desk) => <Notebook desk={desk} q0="订单" />), name: '2 A notebook: searching' }
export const FollowUpSearch: Story = { ...both((desk) => <FollowUp desk={desk} q0="订单" />), name: '3 Has it been done: searching' }
export const NothingFound: Story = { ...both((desk) => <Notebook desk={desk} q0="invoice" />), name: 'Nothing found (the same in each)' }
