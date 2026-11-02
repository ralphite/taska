// Words that may be misheard: marked, on the New input page, the other version picked, a word one model was unsure of, in several places, on the phone, being corrected.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { openDoubts } from '../../model/doubts'
import { Frames } from '../../stories/Frames'
import { HEARD, HEARD_TEXT } from '../../stories/doubtFixtures'
import { Doubts } from './Doubts'
import { VOICE, boxAt } from '../../stories/boxFixtures'
import { AGAIN, AGAIN_HEARD, Picking, quiet } from '../../stories/doubtsFixtures'

export default { title: 'Components/Input box/Voice/Maybe misheard' } satisfies Meta
type Story = StoryObj

export const MaybeMisheard: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {(layout) => boxAt({ text: HEARD_TEXT, files: HEARD.map((h) => ({ ...VOICE, ...h, tr: HEARD_TEXT })), doubts: <Doubts view={layout === 'desk' ? { kind: 'list', lines: openDoubts(HEARD_TEXT, HEARD) } : { kind: 'phone', toCheck: 1, showing: false }} on={quiet} /> }, layout === 'desk')}
    </Frames>
  ),
}
export const MaybeMisheardOnTheNewInputPage: Story = {
  name: 'Maybe misheard, on the New input page',
  render: () => <Frames phone={false} deskWidth={640}>{() => <Doubts view={{ kind: 'card', toCheck: 1 }} on={quiet} />}</Frames>,
}
/** The words with the two versions to pick from (click, or left/right in them): pick the other version. */
export const MaybeMisheardTheOtherVersionPicked: Story = { name: 'Maybe misheard, the other version picked', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} />}</Frames> }

/** A word one model was unsure of: underlined in the words. */
export const AWordOneModelWasUnsureOf: Story = { render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} />}</Frames> }

export const MisheardInSeveralPlaces: Story = {
  name: 'Misheard in several places',
  render: () => <Frames phone={false} deskWidth={640}>{() => <Doubts view={{ kind: 'list', lines: openDoubts(AGAIN, AGAIN_HEARD) }} on={quiet} />}</Frames>,
}
export const MisheardWordsAllPickedPhone: Story = { name: 'Misheard words all picked (phone)', render: () => <Frames desk={false} phoneWidth={393}>{() => <Doubts view={{ kind: 'phone', toCheck: 0, showing: false }} on={quiet} />}</Frames> }
export const MaybeMisheardWordsShownPhone: Story = { name: 'Maybe misheard, words shown (phone)', render: () => <Frames desk={false} phoneWidth={393}>{() => <Doubts view={{ kind: 'phone', toCheck: 1, showing: true }} on={quiet} />}</Frames> }
/** The New input page's card: a voice note's own words selected to correct them. */
export const CorrectingItsWords: Story = { render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix />}</Frames> }
