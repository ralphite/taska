import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Frames } from '../../stories/Frames'
import { acts } from '../../stories/acts'
import { RecBar } from '../../ui/PlaceVoice'
import { SelectionBar } from './SelectionBar'

const meta: Meta = { title: 'Components/Input box/Bar over selected words' }
export default meta
type Story = StoryObj

const at = { top: 40, bottom: 60, left: 60, width: 180, height: 20 }
const acted = acts('Selection bar', ['comment', 'fix', 'check', 'send'] as const, { comment: 'Input box › Commenting on a document › Picking what to comment on', fix: 'Input box › Voice › Maybe misheard' })

/** The bar as the page keeps it: the mic starts recording about the words (the bar becomes its strip, its meter the
 * page's own RecBar); ✕ stops it, ✓ and ↑ hand the recording on (the Actions panel). */
function LiveBar(props: Omit<Parameters<typeof SelectionBar>[0], 'on'>) {
  const [rec, setRec] = useState(props.recording)
  const desk = props.desk ?? true
  const meter = props.meter ?? <RecBar time="0:00" levels={[0.3, 0.75, 0.5, 0.95, 0.4, 0.65, 0.2, 0.85, 0.55, 0.35, 0.9, 0.6].slice(desk ? -6 : -12)} />
  const stop = (then?: () => void) => () => (setRec(false), then?.())
  return <SelectionBar {...props} recording={rec} meter={meter} on={{ mic: () => setRec(!rec), comment: acted.comment, fix: acted.fix, cancel: stop(), check: stop(acted.check), send: stop(acted.send) }} />
}

/** Under selected words: speak about them; a document's words can be commented on, a voice note's corrected. */
export const Bar: Story = {
  name: 'Speak or comment',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={160}>
      {() => (
        <div className="relative h-40">
          <p className="pt-8 pl-14 text-[15px]">Words that were selected</p>
          <LiveBar at={at} recording={false} comment fix={false} />
        </div>
      )}
    </Frames>
  ),
}

/** Words selected in a voice note's words in the box (not a document's): speak about them, or correct them. */
export const SpeakOrCorrect: Story = {
  name: "Speak or correct (a voice note's words)",
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={160}>
      {() => (
        <div className="relative h-40">
          <p className="pt-8 pl-14 text-[15px]">Move the filter to the sidebar</p>
          <LiveBar at={at} recording={false} comment={false} fix />
        </div>
      )}
    </Frames>
  ),
}

/** Recording a comment about them: the bar is its recording strip, where it was (✕, ✓, ↑; B498). Under it, Correct,
 * for a voice note's words. */
export const Recording: Story = {
  name: "Recording; Correct on a voice note's words",
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={200}>
      {(layout) => (
        <div className="relative h-48">
          <LiveBar at={at} recording desk={layout === 'desk'} meter={<RecBar time="0:02" levels={[0.3, 0.75, 0.5, 0.95, 0.4, 0.65, 0.2, 0.85, 0.55, 0.35, 0.9, 0.6].slice(layout === 'desk' ? -6 : -12)} />} comment={false} fix={false} />
          <LiveBar at={{ ...at, top: 110, bottom: 130 }} recording={false} comment={false} fix />
        </div>
      )}
    </Frames>
  ),
}
/** Words selected outside a document (an item's talk, what you said): speak about them, nothing else. */
export const SpeakOnly: Story = {
  name: 'Speak only (words outside a document)',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640} height={160}>
      {() => (
        <div className="relative h-40">
          <p className="pt-8 pl-14 text-[15px]">Words that were selected</p>
          <LiveBar at={at} recording={false} comment={false} fix={false} />
        </div>
      )}
    </Frames>
  ),
}
