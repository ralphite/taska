// T512, T522: Conversation > Message > From an agent: every state of an agent's message in an item's talk
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message/From an agent' }
export default meta

export const Progress: StoryObj = { ...Talk.AgentProgress, name: 'Progress' }
export const Reply: StoryObj = { ...Talk.AgentReply, name: 'Reply' }
export const ToSession: StoryObj = { ...Talk.AgentToSession, name: 'To another session (\u2192 worker)' }
export const Pointed: StoryObj = { ...Talk.AgentPointed, name: 'Pointer on it: \u22ef shows' }
export const Long: StoryObj = { ...Talk.AgentLong, name: 'Long: cut, Show all' }
export const LongPressed: StoryObj = { ...Talk.AgentLongPressed, name: 'Long: pressed to open' }
export const LongOpened: StoryObj = { ...Talk.AgentLongOpened, name: 'Long: opened, Show less' }
export const LatestWhole: StoryObj = { ...Talk.AgentLatestWhole, name: 'Latest message: whole however long' }
export const Report: StoryObj = { ...Talk.AgentReport, name: 'Finished report' }
export const WithPictures: StoryObj = { ...Talk.AgentWithPictures, name: 'With pictures' }
export const DocCodePointed: StoryObj = { ...Talk.AgentDocCodePointed, name: 'Pointer on a document code: its card' }
export const Blocked: StoryObj = { ...Talk.AgentBlocked, name: 'Blocked (answered since)' }
export const Proposal: StoryObj = { ...Talk.AgentProposal, name: 'Proposal' }
export const Decision: StoryObj = { ...Talk.AgentDecision, name: 'Decision' }
export const FromCodex: StoryObj = { ...Talk.AgentCodex, name: 'From Codex' }
export const FromTheOrganizer: StoryObj = { ...Talk.AgentOrganizer, name: 'From the organizer' }
export const Hidden: StoryObj = { ...Talk.AgentHidden, name: 'Hidden: one line' }
export const HiddenShown: StoryObj = { ...Talk.AgentHiddenShown, name: 'Hidden, shown again' }
