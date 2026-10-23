// T512, B515: Input box > Line after sending: the line above the box that says what happened to what you sent (the
// phone: the desktop lists it on the New input page). The parts module draws them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Line after sending' }
export default meta

export const Sending: StoryObj = { ...InputBox.Sending, name: 'Sending' }
export const UploadingThenSending: StoryObj = { ...InputBox.UploadingThenSending, name: 'Uploading, then sending' }
export const SeveralOnTheirWay: StoryObj = { ...InputBox.SeveralOnTheirWay, name: 'Several on their way' }
export const NotSent: StoryObj = { ...InputBox.NotSent, name: 'Not sent' }
export const WaitingForTaska: StoryObj = { ...InputBox.WaitingForTaska, name: 'Waiting for Taska' }
export const SentWaiting: StoryObj = { ...InputBox.SentWaiting, name: 'Sent, waiting for your agent' }
export const SentLeftForYourAgent: StoryObj = { ...InputBox.SentLeftForYourAgent, name: 'Sent, left for your agent' }
export const SentTranscribing: StoryObj = { ...InputBox.SentTranscribing, name: 'Sent, transcribing' }
export const SentOrganizing: StoryObj = { ...InputBox.SentOrganizing, name: 'Sent, organizing' }
export const OrganizerFailed: StoryObj = { ...InputBox.OrganizerFailed, name: 'Organizer failed' }
export const Filed: StoryObj = { ...InputBox.Filed, name: 'Filed by your agent' }
export const SeenNoItem: StoryObj = { ...InputBox.SeenNoItem, name: 'Seen by your agent, no item made' }
export const MovedToAnotherProject: StoryObj = { ...InputBox.MovedToAnotherProject, name: 'Moved to another project' }
export const ChangesUndone: StoryObj = { ...InputBox.ChangesUndone, name: 'Changes undone' }
