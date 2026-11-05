// The input line's parts, every state side by side: what became of an input (each kind, in its words), one still on
// its way (sending, waiting for Taska, not sent), a voice note being recorded. The whole line in each list: Inputs >
// Input card, Inputs tab, New input page.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { failWhy, type Became, type ItemRef } from '../model/became'
import type { Status } from '../model/types'
import { STATUS_WORD } from '../model/words'
import { Frames, States } from '../stories/Frames'
import { BecameLine, OutgoingRow, RecordingRow } from './InputRow'
import { act, acts } from '../stories/acts'

export default { title: 'Components/Inputs/Input card/Every state of a line' } satisfies Meta
type Story = StoryObj

const it = (n: number, code: string, title: string, s: Status = 'open', type: ItemRef['type'] = 'bug'): ItemRef => ({ n, code, type, title, status: { s, label: STATUS_WORD[s] } })
const B014 = it(14, 'B014', 'Coupon box hidden behind the keyboard')
const F012 = it(12, 'F012', 'Export keeps the filter you set', 'doing', 'feature')
const T007 = it(7, 'T007', 'Which formats should the export offer?', 'open', 'task')
/** what the organizer said when it failed, as Taska keeps it (the line says it as failWhy does) */
const FAILED = 'No changes needed · Some commands failed: err: B99 not found'
const BECAME: [string, Became][] = [
  ['made an item', { k: 'filed', items: [{ did: 'Created', item: B014 }], note: null }],
  ['made two, added to one', { k: 'filed', items: [{ did: 'Created', item: B014 }, { did: 'Created', item: it(43, 'F043', 'Close the keyboard by tapping outside it', 'open', 'feature') }, { did: 'Added to', item: F012 }], note: null }],
  ["an item, and the organizer's note", { k: 'filed', items: [{ did: 'Created', item: B014 }], note: 'Commented on D1' }],
  ['an agent changed an item for it (no organizer)', { k: 'filed', items: [{ did: 'Changed', item: F012 }], note: null }],
  ['left for an agent, which changed an item', { k: 'filed', items: [{ did: '', item: F012 }], note: null }],
  ['an answer', { k: 'answer', item: T007 }],
  ["the organizer's note, no item", { k: 'note', text: 'No changes needed' }],
  ['transcribing', { k: 'transcribing' }],
  ['organizing', { k: 'organizing' }],
  ["couldn't organize: Try again", { k: 'failed', why: failWhy(FAILED), retry: true }],
  ["couldn't organize, the organizer off", { k: 'failed', why: failWhy(FAILED), retry: false }],
  ['organizing undone: Organize again', { k: 'undone', retry: true }],
  ['a cancelled recording: Send', { k: 'cancelled' }],
  ['left for an agent', { k: 'agent' }],
  ['waiting for an agent (no organizer)', { k: 'waiting' }],
  ['handled by an agent', { k: 'handled' }],
  ['moved to another project', { k: 'moved', to: 'Mobile app', as: '#4', href: '#' }],
]
// what its buttons do needs Taska or the rest of the page: the Actions panel
const on = acts('Input', ['goto', 'retry', 'send', 'moved'] as const)
const outAct = (label: string) => act(`On its way: ${label}`)

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
              <BecameLine b={b} id="r1" on={on} />
            </div>,
          ])}
        />
      )}
    </Frames>
  ),
}

/** Still on its way, and a voice note being recorded: lines of the same shape, first in the list. */
export const OnItsWayAndRecording: Story = {
  name: 'On its way, recording',
  render: () => (
    <Frames deskWidth={760} height={420}>
      {() => (
        <div className="lg:px-6 lg:py-3">
          <div className="space-y-2 px-4 py-3 lg:px-0">
            <RecordingRow clock="0:12" />
            <OutgoingRow text="Also the sort, please." state="Sending…" bad={false} waiting={false} scope="F012" acts={[]} cancel={outAct('Cancel')} />
            <OutgoingRow text="Make the export button bigger" state="Waiting for Taska…" bad={false} waiting acts={[{ label: 'Edit', run: outAct('Edit') }]} cancel={outAct('Cancel')} />
            <OutgoingRow text="This one Taska refused" state="Not sent" bad waiting={false} acts={[{ label: 'Retry', run: outAct('Retry') }, { label: 'Edit', run: outAct('Edit') }]} cancel={outAct('Cancel')} />
          </div>
        </div>
      )}
    </Frames>
  ),
}
