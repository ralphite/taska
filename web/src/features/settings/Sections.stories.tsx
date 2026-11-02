// Settings' sections, one story for each: the page's own
// Settings (its frame, the way through, the section's own body) with what it shows from the page's own settingsFacts,
// on the desktop beside its column of sections and on the phone as a page of its own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SectionKey } from './sectionList'
import { Frames } from '../../stories/Frames'
import { settingsAt, type SettingsHere } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings' } satisfies Meta
type Story = StoryObj

const one = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames deskWidth={1100} height={760}>{(layout) => settingsAt(sec, layout === 'desk', h)}</Frames> })

/** Every project (this one with this page's counts), new, rename, delete; a deleted one asking to be deleted forever. */
export const Projects: Story = { ...one('projects', { projects: { purging: ['old'] } }), name: 'Projects' }
export const ProjectsRenaming: Story = { ...one('projects', { projects: { renaming: 'home', pErr: 'A project with that address exists' } }), name: 'Renaming a project' }
/** The link and the key to open Taska from anywhere. */
export const UseOnYourPhone: Story = { ...one('phone'), name: 'Use on your phone' }
export const Notifications: Story = { ...one('notifications'), name: 'Notifications' }
/** Words the voice gets wrong and how they are written, and how voice notes are written down. */
export const VoiceSpellings: Story = { ...one('spellings'), name: 'Voice spellings' }
export const Organizer: Story = { ...one('organizer'), name: 'Organizer' }
// ---- more states (B636)
export const NotificationsBlocked: Story = { ...one('notifications', { notifications: { state: 'Blocked by the browser', quiet: false } }), name: 'Notifications: blocked by the browser' }
export const NotificationsOffQuietHours: Story = { ...one('notifications', { notifications: { state: 'Off', quiet: true } }), name: 'Notifications: off' }
export const PhonePushesOnQuiet: Story = { ...one('notifications', { push: { sub: true, blocked: false, quiet: true } }), name: 'Notifications: the phone’s pushes on, quiet hours' }
export const PhonePushesOff: Story = { ...one('notifications', { push: { sub: false, blocked: false, quiet: false } }), name: 'Notifications: the phone’s pushes off' }
export const PhonePushesBlocked: Story = { ...one('notifications', { push: { sub: false, blocked: true, quiet: false } }), name: 'Notifications: blocked by the phone' }
export const NewKeyAsksAgain: Story = { ...one('phone', { newKeyAsking: true }), name: 'Use on your phone: New key asks again' }
export const VoiceSpellingsNoneYet: Story = { ...one('spellings', { noSpellings: true }), name: 'Voice spellings: none yet' }
export const OrganizerOff: Story = { ...one('organizer', { organizerOff: true }), name: 'Organizer: off' }
