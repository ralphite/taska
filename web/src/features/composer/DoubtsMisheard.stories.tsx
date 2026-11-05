// Words that may be misheard: marked, on the New input page, the other version picked, a word one model was unsure of, in several places, on the phone, being corrected.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { openDoubts, pickSide } from '../../model/doubts'
import { Frames } from '../../stories/Frames'
import { HEARD, HEARD_TEXT, PICKED, PICKED_TEXT } from '../../stories/doubtFixtures'
import { DraftCard, DRAFT_WORDS } from './DraftCard'
import { Doubts } from './Doubts'
import { VOICE, boxAt } from '../../stories/boxFixtures'
import { AGAIN, AGAIN_HEARD, LiveWords, Picking } from '../../stories/doubtsFixtures'

export default { title: 'Components/Input box/Voice/Maybe misheard' } satisfies Meta
type Story = StoryObj

/** only the word the main model was unsure of */
const UNSURE = HEARD.map((h) => ({ ...h, doubts: (h.doubts || []).filter((x) => x.why === 'unsure') }))

export const MaybeMisheard: Story = {
  name: 'Maybe misheard',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {(layout) => boxAt({ text: HEARD_TEXT, files: HEARD.map((h) => ({ ...VOICE, ...h, tr: HEARD_TEXT })), heard: {} }, layout === 'desk')}
    </Frames>
  ),
}
/** The New input page: the box says it and points below, to the draft's card with its words to pick from. */
export const MaybeMisheardOnTheNewInputPage: Story = {
  name: 'On the New input page',
  render: () => (
    <Frames phone={false} deskWidth={640}>
      {() => (
        <>
          {boxAt({ text: HEARD_TEXT, files: HEARD.map((h) => ({ ...VOICE, ...h, tr: HEARD_TEXT })), heard: {} }, true)}
          <div className="px-3 pb-3">
            <DraftCard voice={1} ms={14000} files={0} transcribing={false} words={<LiveWords text={HEARD_TEXT} heard={HEARD} className={DRAFT_WORDS} />} hint={{ kind: 'check', n: 1 }} />
          </div>
        </>
      )}
    </Frames>
  ),
}
/** The words with the two versions to pick from (click, or left/right in them): pick the other version. */
export const MaybeMisheardTheOtherVersionPicked: Story = { name: 'The other version picked', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} start="picked" />}</Frames> }

/** A word one model was unsure of: underlined in the words. */
export const AWordOneModelWasUnsureOf: Story = { name: 'A word one model was unsure of', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix={false} heard={UNSURE} />}</Frames> }

/** the list under the box on its own: Use instead takes the other version (the model's pickSide), and the line goes (none left: the list goes) */
function LiveList() {
  const [state, setState] = useState({ text: AGAIN, files: AGAIN_HEARD })
  const use = (fk: string, k: number) => {
    const f = state.files.find((x) => x.key === fk)
    if (!f) return
    const r = pickSide(state.text, f, k, 'alt')
    setState({ text: r.text, files: state.files.map((x) => (x.key === fk ? { ...x, doubts: r.doubts, trAdded: r.trAdded } : x)) })
  }
  const lines = openDoubts(state.text, state.files)
  return lines.length ? <Doubts view={{ kind: 'list', lines }} on={{ use, show: () => {} }} /> : null
}
export const MisheardInSeveralPlaces: Story = {
  name: 'Misheard in several places',
  render: () => <Frames phone={false} deskWidth={640}>{() => <LiveList />}</Frames>,
}
export const MisheardWordsAllPickedPhone: Story = {
  name: 'Misheard words all picked (phone)',
  render: () => <Frames desk={false} phoneWidth={393}>{() => boxAt({ text: PICKED_TEXT, files: PICKED.map((h) => ({ ...VOICE, ...h, tr: PICKED_TEXT })), heard: {} }, false)}</Frames>,
}
/** The phone, Show the words pressed: the box shows its words in place of its field, the misheard ones to pick from. */
export const MaybeMisheardWordsShownPhone: Story = {
  name: 'Its words in the box, to pick from (phone)',
  render: () => (
    <Frames desk={false} phoneWidth={393}>
      {() =>
        boxAt({ text: HEARD_TEXT, files: HEARD.map((h) => ({ ...VOICE, ...h, tr: HEARD_TEXT })), heard: { showing: true } }, false)
      }
    </Frames>
  ),
}
/** The New input page's card: a voice note's own words selected to correct them. */
export const CorrectingItsWords: Story = { name: 'Correcting its words', render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <Picking fix start="fixing" />}</Frames> }
