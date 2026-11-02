// The box changing what you said: editing an input, adding details, adding to a voice-only input, correcting a word, the transcription preferences.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { input } from '../../stories/fixtures'
import { at } from '../../stories/composerFixtures'

export default { title: 'Components/Input box/What it writes to/Changing what you said' } satisfies Meta
type Story = StoryObj

export const EditingAnInput = at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'edit', v: 0 }, text: 'Keep the filter, and the sort.' })
export const AddingDetailsToAnInput = at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'append', v: 0 } })
export const EditingAVoiceOnlyInput: Story = {
  ...at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'append', v: 0 }, inputs: [input({ id: 'r7', text: '', files: [{ f: 'f7-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm' }] })] }),
  name: 'Adding to a voice-only input',
}
export const CorrectingAWord = at({ at: 'F012', mode: { kind: 'correct', id: 'r7', wrong: 'sort', v: 0 }, text: 'order' })
export const CorrectingAWordNothingTyped: Story = { ...at({ at: 'F012', mode: { kind: 'correct', id: 'r7', wrong: 'sort', v: 0 } }), name: 'Correcting a word, nothing typed' }
// ---- more states (B636)
export const EditingTranscriptionPreferences = at({ at: '', mode: { kind: 'prefs', was: '' }, text: 'Write it as said; keep code words as they are.' })
