import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { NeedFrame } from './NeedFrame'
import { PRIMARY_BASE, NEED, SECOND } from './tones'

const meta: Meta = { title: 'UI/Needs you card' }
export default meta
type Story = StoryObj

const now = Date.parse('2026-11-13T10:00:00-08:00')
const t = '2026-11-13T09:40:00-08:00'
const foot = (
  <>
    <button className={`${SECOND} flex-1 lg:flex-none`}>Not now</button>
    <button className={`${PRIMARY_BASE} ${NEED.approve.btn} flex-[1.4] lg:flex-none`}>Approve</button>
  </>
)

/** The card an item's need and a rules proposal are drawn in (B763): to decide, decided, and with no buttons. */
export const Card: Story = {
  name: 'The card: to decide, decided, no buttons',
  render: () => (
    <Frames phoneWidth={393} deskWidth={760}>
      {() => (
        <States
          items={[
            ['to decide', <div className="p-3"><NeedFrame icon="propose" title="Claude proposes a change" t={t} now={now} body="Ask before pushing to main." foot={foot} /></div>],
            ['decided', <div className="p-3"><NeedFrame icon="propose" title="Claude proposes a change" t={t} now={now} done body="Ask before pushing to main." foot={foot} /></div>],
            ['no buttons', <div className="p-3"><NeedFrame icon="ask" title="Claude asks you" t={t} now={now} quiet body="Which export should change?" foot={null} hint="↓ Answer below" /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
