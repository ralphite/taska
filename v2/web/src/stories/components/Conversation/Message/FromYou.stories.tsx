// T512, T522: Conversation > Message > From you: every state of your words in an item's talk, from on their way to read
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message/From you' }
export default meta

export const Words: StoryObj = { ...Talk.YouWords, name: 'Your words' }
export const VoiceNote: StoryObj = { ...Talk.YouVoiceNote, name: 'With a voice note' }
export const WithPictures: StoryObj = { ...Talk.YouWithPictures, name: 'With pictures' }
export const Long: StoryObj = { ...Talk.YouLong, name: 'Long: cut on the desktop' }
export const Sending: StoryObj = { ...Talk.YouSending, name: 'Sending, with Undo' }
export const Uploading: StoryObj = { ...Talk.YouUploading, name: 'Uploading a picture' }
export const WaitingForTaska: StoryObj = { ...Talk.YouWaitingForTaska, name: 'Waiting for Taska' }
export const NotSent: StoryObj = { ...Talk.YouNotSent, name: 'Not sent: Retry, Edit' }
export const JustSent: StoryObj = { ...Talk.YouJustSent, name: 'Just sent: Undo' }
export const ReadByAgent: StoryObj = { ...Talk.YouReadByAgent, name: 'Read by the agent' }
export const ReadByPointed: StoryObj = { ...Talk.YouReadByPointed, name: 'Pointer on Read by: who and when' }
export const ItemCodePointed: StoryObj = { ...Talk.YouItemCodePointed, name: 'Pointer on an item code: its card' }
export const Edited: StoryObj = { ...Talk.YouEdited, name: 'Edited' }
export const EarlierVersion: StoryObj = { ...Talk.YouEarlierVersion, name: 'Edited: the earlier version above' }
export const AddedDetails: StoryObj = { ...Talk.YouAddedDetails, name: 'Details added' }
export const VoicePlaying: StoryObj = { ...Talk.YouVoicePlaying, name: 'Voice note playing' }
export const VoiceStopped: StoryObj = { ...Talk.YouVoiceStopped, name: 'Voice note stopped partway' }
export const Transcribing: StoryObj = { ...Talk.YouTranscribing, name: 'Voice note being transcribed' }
export const Moved: StoryObj = { ...Talk.YouMoved, name: 'Its input moved to another project' }
export const MovedVoicePointed: StoryObj = { ...Talk.YouMovedVoicePointed, name: 'Moved, pointer on its voice note' }
