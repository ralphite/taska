// T512, B515: Settings: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Settings from '../parts/Settings'

const meta: Meta = { title: 'Components/Settings' }
export default meta

export const SettingsIndex: StoryObj = { ...Settings.SettingsIndex, name: 'Settings list on the phone' }
export const Agents: StoryObj = { ...Settings.Agents, name: 'Agents' }
export const AgentsNoneYet: StoryObj = { ...Settings.AgentsNoneYet, name: 'Agents, none yet' }
export const Documents: StoryObj = { ...Settings.Documents, name: 'Documents' }
export const Activity: StoryObj = { ...Settings.Activity, name: 'Activity' }
export const Deleted: StoryObj = { ...Settings.Deleted, name: 'Deleted' }
export const Projects: StoryObj = { ...Settings.Projects, name: 'Projects' }
export const ProjectsRenaming: StoryObj = { ...Settings.ProjectsRenaming, name: 'Renaming a project' }
export const UseOnYourPhone: StoryObj = { ...Settings.UseOnYourPhone, name: 'Use on your phone' }
export const Notifications: StoryObj = { ...Settings.Notifications, name: 'Notifications' }
export const VoiceSpellings: StoryObj = { ...Settings.VoiceSpellings, name: 'Voice spellings' }
export const Organizer: StoryObj = { ...Settings.Organizer, name: 'Organizer' }
