// Words that may be misheard: marked, on the New input page, the other version picked, a word one model was unsure of, in several places, on the phone, being corrected.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { openDoubts, spotsIn } from '../../model/doubts'
import { Frames } from '../../stories/Frames'
import { HEARD, HEARD_TEXT } from '../../stories/doubtFixtures'
import { BOX_WORDS_LOOK, Doubts, DraftWords } from './Doubts'
import { VOICE, boxAt } from '../../stories/boxFixtures'
import { AGAIN, AGAIN_HEARD, Picking, quiet } from '../../stories/doubtsFixtures'

export default { title: 'Components/Input box/Voice/Maybe misheard' } satisfies Meta
type Story = StoryObj

export const MaybeMisheard: Story = {
  name: 'Maybe misheard',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {(layout) => boxAt({ text: HEARD_TEXT, files: HEARD.map((h) => ({ ...VOICE, ...h, tr: HEARD_TEXT })), doubts: <Doubts view={layout === 'desk' ? { kind: 'list', lines: openDoubts(HEARD_TEXT, HEARD) } : { kind: 'phone', toCheck: 1, showing: false }} on={quiet} /> }, layout === 'desk')}
    </Frames>
  ),
}
export const MaybeMisheardOnTheNewInputPage: Story = {
  name: 'On the New input page',
  render: () => <Frames phone={false} deskWidth={640}>{() => <Doubts view={{ kind: 'card', toCheck: 1 }} on={quiet} />}</Frames>,
}
/** The words with the two versions to pick from (click, or left/right in them): pick the other version. */
export const MaybeMisheardTheOtherVersionPicked: Story = { name: 'The other version picked', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} start="picked" />}</Frames> }

/** A word one model was unsure of: underlined in the words. */
export const AWordOneModelWasUnsureOf: Story = { name: 'A word one model was unsure of', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} />}</Frames> }

export const MisheardInSeveralPlaces: Story = {
  name: 'Misheard in several places',
  render: () => <Frames phone={false} deskWidth={640}>{() => <Doubts view={{ kind: 'list', lines: openDoubts(AGAIN, AGAIN_HEARD) }} on={quiet} />}</Frames>,
}
export const MisheardWordsAllPickedPhone: Story = { name: 'Misheard words all picked (phone)', render: () => <Frames desk={false} phoneWidth={393}>{() => <Doubts view={{ kind: 'phone', toCheck: 0, showing: false }} on={quiet} />}</Frames> }
/** The phone, Show the words pressed: the box shows its words in place of its field, the misheard ones to pick from. */
export const MaybeMisheardWordsShownPhone: Story = {
  name: 'Its words in the box, to pick from (phone)',
  render: () => (
    <Frames desk={false} phoneWidth={393}>
      {() =>
        boxAt({ text: HEARD_TEXT, files: HEARD.map((h) => ({ ...VOICE, ...h, tr: HEARD_TEXT })), doubts: <Doubts view={{ kind: 'phone', toCheck: 1, showing: true }} on={quiet} /> }, false, {
          words: <DraftWords text={HEARD_TEXT} spots={spotsIn(HEARD_TEXT, HEARD)} className={BOX_WORDS_LOOK} on={{ pick: () => {}, escape: () => {}, plain: () => {} }} />,
        })
      }
    </Frames>
  ),
}
/** The New input page's card: a voice note's own words selected to correct them. */
export const CorrectingItsWords: Story = { name: 'Correcting its words', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix start="fixing" />}</Frames> }
