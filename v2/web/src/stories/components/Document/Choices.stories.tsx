// T512, B515: Document > Choices: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Document from '../parts/Document'

const meta: Meta = { title: 'Components/Document/Choices' }
export default meta

export const Checklist: StoryObj = { ...Document.Checklist, name: 'Nothing ticked' }
export const TickedNotSent: StoryObj = { ...Document.TickedNotSent, name: 'Ticked, not sent yet' }
export const Sent: StoryObj = { ...Document.Sent, name: 'Sent' }
export const SentPointedAt: StoryObj = { ...Document.SentPointedAt, name: 'Sent, pointed at: Modify' }
export const SentChanging: StoryObj = { ...Document.SentChanging, name: 'Sent, being changed' }
export const Skipped: StoryObj = { ...Document.Skipped, name: 'Skipped: replied on the item instead' }
