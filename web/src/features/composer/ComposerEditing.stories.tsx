// The box changing what you said: editing an input, adding details, adding to a voice-only input, correcting a word, the transcription preferences.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { input } from '../../stories/fixtures'
import { at } from '../../stories/composerFixtures'
import { record, shown } from '../../stories/fixtures'

export default { title: 'Components/Input box/What it writes to/Changing what you said' } satisfies Meta
type Story = StoryObj

export const EditingAnInput: Story = { ...at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'edit', v: 0 }, text: 'Keep the filter, and the sort.' }), name: 'Editing an input' }
export const AddingDetailsToAnInput: Story = { ...at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'append', v: 0 } }), name: 'Adding details to an input' }
export const EditingAVoiceOnlyInput: Story = {
  ...at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'append', v: 0 }, inputs: [shown(input({ id: 'r7', text: '', files: [{ f: 'f7-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm' }] }), record('f7-voice_0-07.webm', 'Keep the filter when the page is opened again.'))] }),
  name: 'Adding to a voice-only input',
}
export const CorrectingAWord: Story = { ...at({ at: 'F012', mode: { kind: 'correct', id: 'r7', wrong: 'sort', v: 0 }, text: 'order' }), name: 'Correcting a word' }
export const CorrectingAWordNothingTyped: Story = { ...at({ at: 'F012', mode: { kind: 'correct', id: 'r7', wrong: 'sort', v: 0 } }), name: 'Correcting a word, nothing typed' }
// ---- more states (B636)
export const EditingTranscriptionPreferences: Story = { ...at({ at: '', mode: { kind: 'prefs', was: '' }, text: 'Write it as said; keep code words as they are.' }), name: 'Editing how voice is written out' }
