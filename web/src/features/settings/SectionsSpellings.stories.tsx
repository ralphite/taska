// Settings' Voice spellings: some, and none yet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings/Voice spellings' } satisfies Meta
type Story = StoryObj

/** Words the voice gets wrong and how they are written, and how voice notes are written down. */
export const VoiceSpellings: Story = { ...one('spellings'), name: 'Spellings and preferences' }
export const VoiceSpellingsNoneYet: Story = { ...one('spellings', { noSpellings: true }), name: 'None yet' }
// ---- more states (T639)
export const SpellingsLoading: Story = { ...one('spellings', { spellingsLoading: true }), name: 'Loading' }
export const PreferencesBeingEdited: Story = { ...one('spellings', { prefs: { editing: true } }), name: 'The preferences being edited' }
export const TidyOff: Story = { ...one('spellings', { prefs: { tidyOff: true } }), name: 'Tidy off' }
export const DefaultPreferences: Story = { ...one('spellings', { prefs: { isDefault: true } }), name: 'Default preferences' }
