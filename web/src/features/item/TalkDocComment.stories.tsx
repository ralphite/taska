// A comment on one of the item's documents, as it shows in the item's talk: the page's own talk, the document's comments among its messages in time.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Comment } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, item } from '../../stories/fixtures'
import { comment, doc } from '../../stories/itemFixtures'
import { talkOf } from '../../stories/itemPage'

export default { title: 'Components/Conversation/Message/Document comment' } satisfies Meta
type Story = StoryObj

const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
const TABLE = '| Step | Who |\n| --- | --- |\n| Goals | Coordinator |'
const at = (comments: Comment[], key = 'k1', text = 'The export keeps the filter.'): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const d = doc({ d: 1, n: 12, title: 'Plan: the export keeps the filter', blocks: key === 'doc' ? [] : [{ key, kind: key === 't1' ? 'table' : 'para', text, comments }], whole: key === 'doc' ? comments : [] })
        return talkOf(item({ n: 12, thread: [] }), layout === 'desk', { docs: [d] })
      }}
    </Frames>
  ),
})

export const YoursWithWhatItIsAbout: Story = { ...at([comment({ id: 9, t: later(1), quote: 'keeps the filter', text: 'And the sort too?' })]), name: 'Yours, with what it is about' }
export const AnAgentsAnswer: Story = {
  ...at([comment({ id: 9, t: later(1), quote: 'keeps the filter', text: 'And the sort too?' }), comment({ id: 10, th: 9, by: 'claude-code', t: later(3), quote: '', text: 'Yes: added to the plan.' })]),
  name: 'An agent’s answer',
}
export const OnTheWholeDocument = at([comment({ id: 9, key: 'doc', t: later(1), quote: '', text: 'Looks good as a whole.' })], 'doc')
export const AboutATable = at([comment({ id: 9, key: 't1', t: later(1), quote: '', text: 'Who signs it off?' })], 't1', TABLE)
export const VoiceCommentNoWordsHeard: Story = {
  ...at([comment({ id: 9, t: later(1), quote: 'keeps the filter', text: '', files: [{ f: 'f5-voice_0-03.webm', name: 'voice_0-03.webm', mime: 'audio/webm' }] })]),
  name: 'Voice comment, no words heard',
}
