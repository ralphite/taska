// T512, T522: Conversation > Message parts: what a message is made of, each part in its states
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message parts' }
export default meta

export const Markdown: StoryObj = { ...Talk.Markdown, name: 'Markdown' }
export const VoiceChipPointed: StoryObj = { ...Talk.VoiceChipPointed, name: 'Voice note, pointer on it' }
export const DocumentCard: StoryObj = { ...Talk.DocumentCard, name: 'Document card' }
export const DocumentCardPointed: StoryObj = { ...Talk.DocumentCardPointed, name: 'Document card, pointer on it' }
