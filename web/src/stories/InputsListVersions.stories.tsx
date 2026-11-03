// B629: the list of inputs, redrawn from the notebook version Yadong found closest (words first, no boxes or bubbles),
// with the room cut: the Inputs tab on the phone, the list under New input on the desktop. One set of inputs covering
// every state an input has (b629/inputsDemo), drawn with the page's own parts (the item's status mark, the voice
// note's chip, the pictures). A long input opens with More.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Frames } from './Frames'
import { InputsList } from './b629/InputItem'
import { ENTRIES } from './b629/inputsDemo'

export default { title: 'Prototype/B629 Inputs list', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

function List({ desk, opened = [], pointed = null, empty = false }: { desk: boolean; opened?: string[]; pointed?: string | null; empty?: boolean }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(opened))
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))
  return (
    <div className={desk ? 'h-full overflow-y-auto px-6 py-5' : 'h-full overflow-y-auto'}>
      <InputsList list={empty ? [] : ENTRIES} desk={desk} opened={open} toggle={toggle} pointed={pointed} />
    </div>
  )
}

const phone = (p: Omit<Parameters<typeof List>[0], 'desk'> = {}): Story => ({ render: () => <Frames desk={false}>{() => <List desk={false} {...p} />}</Frames> })
const desk = (p: Omit<Parameters<typeof List>[0], 'desk'> = {}): Story => ({ render: () => <Frames phone={false} deskWidth={820} height={852}>{() => <List desk {...p} />}</Frames> })

/** The phone: each input's number and when, its words, its files, and what became of it under them. */
export const Phone: Story = { ...phone(), name: 'Phone' }
/** The desktop: what became of each input beside its words; Add more and ⋯ under the pointer. */
export const Desktop: Story = { ...desk(), name: 'Desktop' }
/** A long input opened whole (Less closes it again). */
export const PhoneLongOpened: Story = { ...phone({ opened: ['r65'] }), name: 'Phone: a long input opened' }
/** The pointer on #73 (its buttons show), and the long input opened. */
export const DesktopPointed: Story = { ...desk({ pointed: 'r73', opened: ['r65'] }), name: 'Desktop: pointer on an input, a long one opened' }
/** None yet. */
export const NoneYet: Story = { render: () => <Frames deskWidth={820} height={300}>{(layout) => <List desk={layout === 'desk'} empty />}</Frames>, name: 'No inputs yet' }
