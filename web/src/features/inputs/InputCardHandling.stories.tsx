// An input on its way: a voice note, being written out, being organized (next in line too), waiting for an agent (the organizer off).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'UI/Inputs page/Input row/Being handled' } satisfies Meta
type Story = StoryObj

export const VoiceNote: Story = { ...one(ONE.voice), name: 'Voice note' }
/** Said into the box's mic and sent while the speech model still works out its words. */
export const Transcribing: Story = { ...one(ONE.transcribing), name: 'Transcribing' }
/** The organizer is working on it now. */
export const Organizing: Story = { ...one(ONE.organizing, { busy: 'r20' }), name: 'Organizing' }
/** With its screenshot: no agent has read it yet (the organizer is off). */
export const WaitingForYourAgent: Story = { ...one(ONE.waiting, { organizer: false }), name: 'Waiting for an agent: organizer off' }
