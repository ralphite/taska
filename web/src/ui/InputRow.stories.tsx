// The input line's parts, every state side by side: what became of an input (each kind, in its words), one still on
// its way (sending, waiting for Taska, not sent), a voice note being recorded. The whole line in each list: Inputs >
// Input card, Inputs tab, New input page.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { failWhy, type Became, type ItemRef } from '../model/became'
import type { Status } from '../model/types'
import { STATUS_WORD } from '../model/words'
import { Frames, States } from '../stories/Frames'
import { BecameLine, OutgoingRow } from './InputRow'
import { phaseIn, type OutPhase } from '../model/outgoingStates'
import { act, acts } from '../stories/acts'

export default { title: 'UI/Inputs page/Input row/Every state of a line' } satisfies Meta
type Story = StoryObj

const it = (n: number, code: string, title: string, s: Status = 'open', type: ItemRef['type'] = 'bug'): ItemRef => ({ n, code, type, title, status: { s, label: STATUS_WORD[s] } })
const B014 = it(14, 'B014', 'Coupon box hidden behind the keyboard')
const F012 = it(12, 'F012', 'Export keeps the filter you set', 'doing', 'feature')
const T007 = it(7, 'T007', 'Which formats should the export offer?', 'open', 'task')
/** what the organizer said when it failed, as Taska keeps it (the line says it as failWhy does) */
const FAILED = 'No changes needed · Some commands failed: err: B99 not found'
const BECAME: [string, Became][] = [
  ['made an item', { k: 'filed', items: [{ did: 'Created', item: B014 }], note: null, undo: true }],
  ['made two, added to one', { k: 'filed', items: [{ did: 'Created', item: B014 }, { did: 'Created', item: it(43, 'F043', 'Close the keyboard by tapping outside it', 'open', 'feature') }, { did: 'Added to', item: F012 }], note: null, undo: true }],
  ["an item, and the organizer's note", { k: 'filed', items: [{ did: 'Created', item: B014 }], note: 'Commented on D1', undo: true }],
  ['an agent changed an item for it (no organizer)', { k: 'filed', items: [{ did: 'Changed', item: F012 }], note: null, undo: false }],
  ['left for an agent, which changed an item', { k: 'filed', items: [{ did: '', item: F012 }], note: null, undo: false }],
  ['an answer', { k: 'answer', item: T007, undo: false }],
  ["the organizer's note, no item", { k: 'note', text: 'No changes needed' }],
  ['transcribing', { k: 'transcribing', state: 'sentTranscribing' }],
  ['organizing', { k: 'organizing' }],
  ["couldn't organize: Try again", { k: 'failed', why: failWhy(FAILED), raw: FAILED, retry: true }],
  ["couldn't organize, the organizer off", { k: 'failed', why: failWhy(FAILED), raw: FAILED, retry: false }],
  ['organizing undone: Organize again', { k: 'undone', retry: true }],
  ['a cancelled recording: Send', { k: 'cancelled' }],
  ['for an agent: left by the organizer, or none on', { k: 'agent' }],
  ['handled by an agent', { k: 'handled' }],
  ['moved to another project', { k: 'moved', to: 'Mobile app', as: '#4', href: '#' }],
]
// what its buttons do needs Taska or the rest of the page: the Actions panel
const on = acts('Input', ['goto', 'retry', 'send', 'moved'] as const)
const outOn = { retry: act('On its way: Retry'), edit: act('On its way: Edit'), cancel: act('On its way: Cancel') }
/** what the desktop's New input list shows in a phase (model/outgoingStates) */
const rowShow = (p: OutPhase) => phaseIn(p, 'row') ?? { say: '', tone: 'busy' as const, acts: [] }

/** What became of an input, each kind as every list says it. */
export const WhatItBecame: Story = {
  name: 'What became of it',
  render: () => (
    <Frames desk={false}>
      {() => (
        <States
          items={BECAME.map(([name, b]): [string, ReactNode] => [
            name,
            <div key={name} className="px-4 py-2 text-[13px] leading-5">
              <BecameLine b={b} id="r1" place="row" on={on} />
            </div>,
          ])}
        />
      )}
    </Frames>
  ),
}

/** Still on its way: lines of the same shape, first in the list. */
export const OnItsWay: Story = {
  name: 'On its way',
  render: () => (
    <Frames deskWidth={760} height={420}>
      {() => (
        <div className="lg:px-6 lg:py-3">
          <div className="space-y-2 px-4 py-3 lg:px-0">
            <OutgoingRow text="Also the sort, please." show={rowShow('sending')} scope="F012" on={outOn} />
            <OutgoingRow text="The button here" show={rowShow('uploading')} on={outOn} />
            <OutgoingRow text="Make the export button bigger" show={rowShow('waiting')} on={outOn} />
            <OutgoingRow text="This one Taska refused" show={rowShow('notSent')} on={outOn} />
          </div>
        </div>
      )}
    </Frames>
  ),
}
