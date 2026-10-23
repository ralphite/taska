// T512, B515: Inputs > Input card: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Inputs from '../parts/Inputs'

const meta: Meta = { title: 'Components/Inputs/Input card' }
export default meta

export const WaitingForYourAgent: StoryObj = { ...Inputs.WaitingForYourAgent, name: 'Waiting for your agent' }
export const VoiceNote: StoryObj = { ...Inputs.VoiceNote, name: 'Voice note' }
export const Transcribing: StoryObj = { ...Inputs.Transcribing, name: 'Transcribing' }
export const MadeAnItem: StoryObj = { ...Inputs.MadeAnItem, name: 'Made an item' }
export const AddedToAnItem: StoryObj = { ...Inputs.AddedToAnItem, name: 'Added to an item' }
export const Organizing: StoryObj = { ...Inputs.Organizing, name: 'Organizing' }
export const LeftForYourAgent: StoryObj = { ...Inputs.LeftForYourAgent, name: 'Left for your agent' }
export const HandledByYourAgent: StoryObj = { ...Inputs.HandledByYourAgent, name: 'Handled by your agent' }
export const SeenByYourAgent: StoryObj = { ...Inputs.SeenByYourAgent, name: 'Seen by your agent' }
export const OrganizerFailed: StoryObj = { ...Inputs.OrganizerFailed, name: 'Organizer failed' }
export const Undone: StoryObj = { ...Inputs.Undone, name: 'Undone' }
export const Edited: StoryObj = { ...Inputs.Edited, name: 'Edited' }
export const MovedToAnotherProject: StoryObj = { ...Inputs.MovedToAnotherProject, name: 'Moved to another project' }
export const AnAnswer: StoryObj = { ...Inputs.AnAnswer, name: 'An answer' }
