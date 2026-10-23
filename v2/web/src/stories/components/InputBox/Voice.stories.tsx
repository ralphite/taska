// T512, B515: Input box > Voice: a voice note from recording to its words, and what can go wrong; the box alone, in an
// item. The parts module draws them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Voice' }
export default meta

export const Recording: StoryObj = { ...InputBox.Recording, name: 'Recording' }
export const RecordingPointingAtTheCheck: StoryObj = {
  ...InputBox.RecordingPointingAtTheCheck,
  name: 'Recording, pointing at the check',
}
export const VoiceTranscribing: StoryObj = { ...InputBox.VoiceTranscribing, name: 'Transcribing' }
export const VoiceRetrying: StoryObj = { ...InputBox.VoiceRetrying, name: 'Transcribing, trying again' }
export const VoiceWithWords: StoryObj = { ...InputBox.VoiceWithWords, name: 'Transcribed, its words in the box' }
export const VoiceDoubts: StoryObj = { ...InputBox.VoiceDoubts, name: 'Maybe misheard' }
export const VoiceOtherPicked: StoryObj = {
  ...InputBox.VoiceOtherPicked,
  name: 'Maybe misheard, the other version picked',
}
export const VoiceDoubtsOnNewInputPage: StoryObj = {
  ...InputBox.VoiceDoubtsOnNewInputPage,
  name: 'Maybe misheard, on the New input page',
}
export const VoiceUnsure: StoryObj = { ...InputBox.VoiceUnsure, name: 'A word one model was unsure of' }
export const VoiceCutShort: StoryObj = { ...InputBox.VoiceCutShort, name: 'May be cut short' }
export const VoiceNoWords: StoryObj = { ...InputBox.VoiceNoWords, name: 'No words heard' }
export const VoiceFailed: StoryObj = { ...InputBox.VoiceFailed, name: 'No transcript' }
