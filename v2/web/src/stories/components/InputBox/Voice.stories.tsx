// T512, B515: Input box > Voice: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Voice' }
export default meta

export const Recording: StoryObj = { ...InputBox.Recording, name: 'Recording' }
export const VoiceTranscribing: StoryObj = { ...InputBox.VoiceTranscribing, name: 'Transcribing' }
export const VoiceWithWords: StoryObj = { ...InputBox.VoiceWithWords, name: 'With its words' }
export const VoiceDoubts: StoryObj = { ...InputBox.VoiceDoubts, name: 'Maybe misheard' }
export const VoiceFailed: StoryObj = { ...InputBox.VoiceFailed, name: 'Transcription failed' }
