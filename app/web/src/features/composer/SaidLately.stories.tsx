import type { Meta, StoryObj } from '@storybook/react-vite'
import { standing, SHORT_STANDING } from '../../model/inputs'
import { Frames } from '../../stories/Frames'
import { input } from '../../stories/fixtures'
import type { Input } from '../../model/types'
import { Thumbs } from '../../ui/Files'
import type { SaidInput } from '../../model/saidLately'
import { SaidLately, type SaidEvents } from './SaidLately'

const meta: Meta = { title: 'Components/You said' }
export default meta
type Story = StoryObj

const on: SaidEvents = { goto() {}, more() {}, append() {}, draft() {}, menu() {}, undoSend() {}, retry() {}, outboxRetry() {}, outboxEdit() {}, query() {}, loadMore() {} }
const org = { on: false, busy: null }
const row = (r: Input, extra: Partial<SaidInput> = {}): SaidInput => {
  const s = standing(r, org, (x) => x)
  return { r, code: '#' + r.id.slice(1), time: '14:57', day: null, standing: s, short: SHORT_STANDING[s.label] || s.label, scope: null, chips: [], busy: false, draft: null, canUndoSend: false, retry: null, opened: false, ...extra }
}
const voice = { f: 'f10-voice_0-16.webm', name: 'voice_0-16.webm', mime: 'audio/webm' }

/** What you said under New input, the latest first, with where each stands and what became of it. */
export const SaidList: Story = {
  render: () => (
    <Frames phone={false} deskWidth={1024}>
      {() => (
        <div className="mx-auto max-w-[42rem] p-6">
          <SaidLately
            count={5}
            total={5}
            q=""
            words={[]}
            more={false}
            outgoing={[
              { q: 'a', text: 'Buy milk on the way home', state: 'Waiting for Taska…', failed: true, net: true, canUndo: false },
              { q: 'b', text: 'This one Taska refused', state: 'Not sent', failed: true, net: false, canUndo: false },
            ]}
            rows={[
              row(input({ id: 'r819', text: 'For big changes, show me one first and wait for my yes.', acked: true, touched: [579, 529], org: { ok: true, msg: 'Created R579 · Updated T529', t: '', keep: false, changed: true, undone: false }, files: [voice] }), {
                day: 'Today',
                chips: [
                  { n: 579, code: 'R579', type: 'rule', title: 'Big changes: one first, then the rest', status: { s: 'proposed', label: 'Proposed' } },
                  { n: 529, code: 'T529', type: 'task', title: 'Review each Storybook component', status: { s: 'doing', label: 'In progress' } },
                ],
                scope: { n: 518, code: 'T518', type: 'task', title: 'Storybook', status: { s: 'doing', label: 'In progress' } },
              }),
              row(input({ id: 'r818', text: 'Waiting for the agent to pick this up.' })),
              row(input({ id: 'r817', text: 'Seen and handled.', acked: true })),
              row(input({ id: 'r816', text: 'The organizer could not file this one.', org: { ok: false, msg: 'Gemini HTTP 503: overloaded', t: '', keep: false, changed: false, undone: false } }), { retry: 'Retry', day: 'Yesterday' }),
              row(input({ id: 'r815', text: 'A long one. '.repeat(30) })),
            ]}
            files={(f) => <Thumbs files={f} url={(x) => '#' + x} size="size-12" play={() => ({ playing: false, t: null })} tidy={false} on={{ play() {}, words() {}, view() {} }} />}
            on={on}
          />
        </div>
      )}
    </Frames>
  ),
}
