// The line over the input box after you send: what is on
// its way, or what became of the input you sent, as the page works it out (feedbackLine), drawn by its Feedback.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Input } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { input } from '../../stories/fixtures'
import { out, sentLine } from '../../stories/boxFixtures'

export default { title: 'Components/Input box/Line after sending' } satisfies Meta
type Story = StoryObj

const at = (f: Parameters<typeof sentLine>[0]): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => sentLine(f, layout === 'desk')}</Frames> })
const sent = (f: Partial<Input> = {}) => input({ id: 'r12', text: 'Buy milk on the way home', ...f })
const org = (ok: boolean, msg: string) => ({ ok, msg, t: '', keep: false, changed: ok, undone: false })

export const Sending = at({ mine: [out()], undoable: true })
export const UploadingThenSending: Story = { ...at({ mine: [out({ text: '', files: [{ f: '', name: 'shot.png', mime: 'image/png', uploading: true }] })] }), name: 'Uploading, then sending' }
export const SeveralOnTheirWay = at({ mine: [out(), out({ q: 'q2', text: 'And bread' }), out({ q: 'q3', text: 'And eggs' })] })
export const WaitingForTaska = at({ mine: [out({ state: 'failed', net: true })] })
export const SentWaitingForYourAgent: Story = { ...at({ sent: sent() }), name: 'Sent, waiting for your agent' }
export const SentLeftForYourAgent: Story = { ...at({ sent: sent({ org: org(true, 'Left for your coding agent') }), organizer: true }), name: 'Sent, left for your agent' }
export const SentTranscribing: Story = { ...at({ sent: sent({ text: '', trWait: true }) }), name: 'Sent, transcribing' }
export const OrganizerFailed = at({ sent: sent({ org: org(false, 'Gemini HTTP 503: overloaded') }), organizer: true })
export const FiledByYourAgent = at({ sent: sent({ acked: true, touched: [12], org: org(true, 'Created F012') }), organizer: true })
export const SeenByYourAgentNoItemMade: Story = { ...at({ sent: sent({ acked: true, touched: [] }) }), name: 'Seen by your agent, no item made' }
