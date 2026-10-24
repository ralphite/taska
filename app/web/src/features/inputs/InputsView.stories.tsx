import type { Meta, StoryObj } from '@storybook/react-vite'
import { standing } from '../../model/inputs'
import type { Input } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { input, modelOf } from '../../stories/fixtures'
import { talkEnv } from '../../stories/itemFixtures'
import { Thumbs } from './Files'
import { InputsView, type InputFacts } from './InputsView'

const meta: Meta = { title: 'Components/Inputs/Inputs tab' }
export default meta
type Story = StoryObj

const org = { on: true, busy: 'r6' }
const world = talkEnv(modelOf([]), false).world
const row = (r: Input, f: Partial<InputFacts> = {}): InputFacts => ({
  r,
  code: '#' + r.id.slice(1),
  time: '14:30',
  day: null,
  standing: standing(r, org, (s) => s),
  scope: null,
  chips: [],
  note: null,
  noteBad: false,
  spark: false,
  retry: null,
  moved: null,
  draft: null,
  long: false,
  opened: false,
  ...f,
})
const rows: InputFacts[] = [
  row(input({ id: 'r9', acked: false }), { day: 'Today' }),
  row(input({ id: 'r8', acked: true, touched: [12], org: { ok: true, msg: 'Created F012', t: '', keep: false, changed: true, undone: false } }), { chips: [{ n: 12, code: 'F012', type: 'feature', title: 'Export keeps the filter', did: 'Created' }], spark: true }),
  row(input({ id: 'r7', scope: 12, org: { ok: false, msg: 'The organizer timed out', t: '', keep: false, changed: false, undone: false } }), { scope: { n: 12, code: 'F012', title: 'Export keeps the filter' }, note: 'The organizer timed out', noteBad: true, retry: 'Retry' }),
  row(input({ id: 'r6', text: 'Being organized now.' })),
  row(input({ id: 'r5', moved: { to: 'home', as: 'r3' } }), { moved: { href: '#', label: 'Open Home · #3' }, day: 'Yesterday' }),
  row(input({ id: 'r4', text: Array.from({ length: 8 }, (_, i) => `Line ${i + 1} of a long input.`).join('\n'), files: [{ f: 'f2-voice_0-42.webm', name: 'voice_0-42.webm', mime: 'audio/webm' }] }), { long: true }),
]

/** Everything you said, by day, with where each stands and what became of it; what is on its way on top. */
export const Inputs: Story = {
  render: () => (
    <Frames desk={false} phoneWidth={393} height={900}>
      {() => (
        <div className="flex h-full flex-col">
          <InputsView
            hidden={false}
            rows={rows}
            outgoing={[{ q: 'q1', text: 'Also the sort.', state: 'Sending…', bad: false, scope: 'F012', previews: [] }]}
            words={[]}
            world={world}
            hints={null}
            files={(f) => <Thumbs files={f} url={(x) => '#' + x} size="size-11" play={() => ({ playing: false, t: null })} tidy on={{ play() {}, words() {}, view() {} }} />}
            on={{ goto() {}, more() {}, menu() {}, retry() {}, draft() {}, moved() {}, ref() {}, picture() {} }}
          />
        </div>
      )}
    </Frames>
  ),
}
