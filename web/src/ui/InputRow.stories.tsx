// The input line's parts, every state side by side: what became of an input (each kind, in its words), one still on
// its way (sending, waiting for Taska, not sent), a voice note being recorded. The whole line in each list: Inputs >
// Input card, Inputs tab, New input page.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import type { Became, ItemRef } from '../model/became'
import { Frames, States } from '../stories/Frames'
import { BecameLine, OutgoingRow, RecordingRow } from './InputRow'

export default { title: 'Components/Inputs/Input card/Every state of a line' } satisfies Meta
type Story = StoryObj

const it = (n: number, code: string, title: string, s = 'open', type: ItemRef['type'] = 'bug'): ItemRef => ({ n, code, type, title, status: { s, label: s } })
const B014 = it(14, 'B014', 'Coupon box hidden behind the keyboard')
const F012 = it(12, 'F012', 'Export keeps the filter you set', 'doing', 'feature')
const T007 = it(7, 'T007', 'Which formats should the export offer?', 'open', 'task')
const BECAME: [string, Became][] = [
  ['made an item', { k: 'filed', items: [{ did: 'Created', item: B014 }], note: null }],
  ['made two, added to one', { k: 'filed', items: [{ did: 'Created', item: B014 }, { did: 'Created', item: it(43, 'F043', 'Close the keyboard by tapping outside it', 'open', 'feature') }, { did: 'Added to', item: F012 }], note: null }],
  ['an item, and the organizer’s note', { k: 'filed', items: [{ did: 'Created', item: B014 }], note: 'asked about the sort' }],
  ['an agent changed an item for it', { k: 'filed', items: [{ did: 'Changed', item: F012 }], note: null }],
  ['an answer', { k: 'answer', item: T007 }],
  ['the organizer’s note, no item', { k: 'note', text: 'Nothing to file: a thank-you' }],
  ['transcribing', { k: 'transcribing' }],
  ['organizing', { k: 'organizing' }],
  ['waiting to be organized', { k: 'queued' }],
  ['couldn’t organize: Try again', { k: 'failed', why: 'B99 is not in this project', retry: true }],
  ['couldn’t organize, the organizer off', { k: 'failed', why: 'B99 is not in this project', retry: false }],
  ['organizing undone: Organize again', { k: 'undone', retry: true }],
  ['a cancelled recording: Send', { k: 'cancelled' }],
  ['left for an agent', { k: 'agent' }],
  ['waiting for an agent (no organizer)', { k: 'waiting' }],
  ['handled by an agent', { k: 'handled' }],
  ['moved to another project', { k: 'moved', to: 'Mobile app', as: '#4', href: '#' }],
]
const noop = () => {}
const on = { goto: noop, retry: noop, send: noop, moved: noop }

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
          <RecordingRow clock="0:12" />
          <OutgoingRow text="Also the sort, please." state="Sending…" bad={false} scope="F012" acts={[{ label: 'Undo', run: noop }]} />
          <OutgoingRow text="Buy milk on the way home" state="Waiting for Taska…" bad={false} acts={[{ label: 'Edit', run: noop }]} />
          <OutgoingRow text="This one Taska refused" state="Not sent" bad acts={[{ label: 'Retry', run: noop }, { label: 'Edit', run: noop }]} />
        </div>
      )}
    </Frames>
  ),
}
