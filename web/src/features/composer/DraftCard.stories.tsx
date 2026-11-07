import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { HEARD, HEARD_TEXT, PICKED, PICKED_TEXT } from '../../stories/doubtFixtures'
import { LiveWords } from '../../stories/doubtsFixtures'
import { DraftWords } from './Doubts'
import { DraftCard, DRAFT_WORDS } from './DraftCard'

const meta: Meta = { title: 'UI/Input box/Draft card' }
export default meta
type Story = StoryObj

const on = { pick: () => {}, escape: () => {}, select: () => {} }

/** On the New input page: words to check (a version picked swaps the words); a voice note still being transcribed;
 * words to correct. */
export const Cards: Story = {
  name: 'Words to check, being written out, to correct',
  render: () => (
    <Frames phone={false} deskWidth={720}>
      {() => (
        <ol>
          <DraftCard voice={1} ms={14000} files={0} transcribing={false} words={<LiveWords text={HEARD_TEXT} heard={HEARD} className={DRAFT_WORDS} />} hint={{ kind: 'check', n: 2 }} />
          <DraftCard voice={2} ms={65000} files={1} transcribing words={null} hint={null} />
          <DraftCard voice={1} ms={8000} files={0} transcribing={false} words={<DraftWords text="Ship the pilot first." spots={[]} stretches={[[0, 20]]} className={DRAFT_WORDS} on={on} />} hint={{ kind: 'fix' }} />
          <DraftCard voice={1} ms={8000} files={0} transcribing={false} words={<LiveWords text={PICKED_TEXT} heard={PICKED} className={DRAFT_WORDS} />} hint={{ kind: 'fix' }} />
          <DraftCard voice={1} ms={8000} files={0} transcribing={false} words={null} hint={null} />
        </ol>
      )}
    </Frames>
  ),
}
