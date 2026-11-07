// Settings' Voice spellings: some, and none yet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'UI/Settings and help/Settings/Voice spellings' } satisfies Meta
type Story = StoryObj

/** Words the voice gets wrong and how they are written, and how voice notes are written down. */
/** the pointer on the first spelling: its Forget (the desktop shows a row's buttons under the pointer or the keys) */
export const VoiceSpellings: Story = { ...one('spellings'), name: 'Spellings and preferences', parameters: { pseudo: { hover: ['li.group:first-of-type'] } } }
export const VoiceSpellingsNoneYet: Story = { ...one('spellings', { noSpellings: true }), name: 'None yet' }
// ---- more states (T639)
export const SpellingsLoading: Story = { ...one('spellings', { spellingsLoading: true }), name: 'Loading' }
export const PreferencesBeingEdited: Story = { ...one('spellings', { prefs: { editing: true } }), name: 'The preferences being edited' }
export const TidyOff: Story = { ...one('spellings', { prefs: { tidyOff: true } }), name: 'Tidy off' }
export const DefaultPreferences: Story = { ...one('spellings', { prefs: { isDefault: true } }), name: 'Default preferences' }
