// T512, T522: Conversation > Message parts: what a message is made of, each part in its states
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message parts' }
export default meta

export const Markdown: StoryObj = { ...Talk.Markdown, name: 'Markdown' }
export const Pictures: StoryObj = { ...Talk.Pictures, name: 'Pictures' }
export const FilesAndVoice: StoryObj = { ...Talk.FilesAndVoice, name: 'Files and voice notes' }
export const VoiceChipPointed: StoryObj = { ...Talk.VoiceChipPointed, name: 'Voice note, pointer on it' }
export const VoiceNoteLine: StoryObj = { ...Talk.VoiceNoteLine, name: 'Voice note line' }
export const DocumentCard: StoryObj = { ...Talk.DocumentCard, name: 'Document card' }
export const DocumentCardPointed: StoryObj = { ...Talk.DocumentCardPointed, name: 'Document card, pointer on it' }
