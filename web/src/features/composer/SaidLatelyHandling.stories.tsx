// The New input page's latest inputs while one is on its way or being handled: just sent with Undo, not sent and
// sending, a voice note being recorded or written out, organizing, an edit not saved, a recording cancelled (B627).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { out } from '../../stories/boxFixtures'
import { DAY, ONE, saidOf } from '../../stories/inputFixtures'

export default { title: 'Components/Inputs/New input page/Latest inputs/One on its way or being handled' } satisfies Meta
type Story = StoryObj

const list = (s: Parameters<typeof saidOf>[0]): Story => ({ render: () => <Frames phone={false} deskWidth={1024}>{() => <div className="p-6">{saidOf(s)}</div>}</Frames> })
export const LatestInputsRecording: Story = { ...list({ inputs: DAY, recording: '0:12' }), name: 'A voice note being recorded comes first' }
export const LatestInputsJustSentUndo: Story = { ...list({ inputs: DAY, justSent: [DAY[0].id] }), name: 'Just sent: Undo' }
export const LatestInputsNotSentSending: Story = { ...list({ inputs: DAY, outbox: [out({ q: 'a', text: 'Buy milk on the way home', state: 'failed' }), out({ q: 'b', text: 'And bread' })], justSent: ['b'] }), name: 'Not sent, and sending with Undo' }
export const LatestInputsTranscribingAndHandled: Story = { ...list({ inputs: [ONE.transcribing, ONE.handled, ONE.made] }), name: 'A voice note being written out, one handled by the agent' }
/** A recording cancelled with Esc: kept, its voice note playable, sent to no one until Send. */
export const LatestInputsCancelled: Story = { ...list({ inputs: [ONE.cancelled, ...DAY] }), name: 'A cancelled recording: Send' }
export const LatestInputsDraftOpenedOrganizing: Story = { ...list({ busy: DAY[0].id, inputs: DAY, editDrafts: [DAY[1].id], opened: [ONE.long.id] }), name: 'Organizing, an edit not saved, a long one opened' }
