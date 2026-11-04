import type { Meta, StoryObj } from '@storybook/react-vite'
import { spotsIn, voiceStretches } from '../../model/doubts'
import { Frames } from '../../stories/Frames'
import { HEARD, HEARD_TEXT, PICKED, PICKED_TEXT } from '../../stories/doubtFixtures'
import { DraftWords } from './Doubts'
import { DraftCard, DRAFT_WORDS } from './DraftCard'

const meta: Meta = { title: 'Components/Input box/Draft card' }
export default meta
type Story = StoryObj

const on = { pick: () => {}, escape: () => {}, select: () => {} }
const send = () => {}

/** On the New input page: words to check; a voice note still being transcribed; words to correct. */
export const Cards: Story = {
  name: 'Words to check, being written out, to correct',
  render: () => (
    <Frames phone={false} deskWidth={720}>
      {() => (
        <div className="space-y-2">
          <DraftCard voice={1} ms={14000} files={0} transcribing={false} words={<DraftWords text={HEARD_TEXT} spots={spotsIn(HEARD_TEXT, HEARD)} stretches={voiceStretches(HEARD_TEXT, HEARD)} className={DRAFT_WORDS} look="card" on={on} />} hint={{ kind: 'check', n: 2 }} onSend={send} />
          <DraftCard voice={2} ms={65000} files={1} transcribing words={null} hint={null} onSend={send} />
          <DraftCard voice={1} ms={8000} files={0} transcribing={false} words={<DraftWords text="Ship the pilot first." spots={[]} stretches={[[0, 20]]} className={DRAFT_WORDS} look="card" on={on} />} hint={{ kind: 'fix' }} onSend={send} />
          <DraftCard voice={1} ms={8000} files={0} transcribing={false} words={<DraftWords text={PICKED_TEXT} spots={spotsIn(PICKED_TEXT, PICKED)} stretches={voiceStretches(PICKED_TEXT, PICKED)} className={DRAFT_WORDS} look="card" on={on} />} hint={{ kind: 'fix' }} onSend={send} />
          <DraftCard voice={1} ms={8000} files={0} transcribing={false} words={null} hint={null} onSend={send} />
        </div>
      )}
    </Frames>
  ),
}
