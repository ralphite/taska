// T512, B515: Conversation > Message parts: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message parts' }
export default meta

export const Markdown: StoryObj = { ...Talk.Markdown, name: 'Markdown' }
export const Pictures: StoryObj = { ...Talk.Pictures, name: 'Pictures' }
export const FilesAndVoice: StoryObj = { ...Talk.FilesAndVoice, name: 'Files and voice notes' }
export const VoiceNoteLine: StoryObj = { ...Talk.VoiceNoteLine, name: 'Voice note line' }
export const DocumentCard: StoryObj = { ...Talk.DocumentCard, name: 'Document card' }
