// Settings' Voice spellings: some, and none yet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings/Voice spellings' } satisfies Meta
type Story = StoryObj

/** Words the voice gets wrong and how they are written, and how voice notes are written down. */
export const VoiceSpellings: Story = { ...one('spellings'), name: 'Voice spellings' }
export const VoiceSpellingsNoneYet: Story = { ...one('spellings', { noSpellings: true }), name: 'Voice spellings: none yet' }
