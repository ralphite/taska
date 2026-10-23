// T512, B515: Item page > Needs-you card: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Item from '../parts/Item'
import * as ItemReplied from '../parts/ItemReplied'

const meta: Meta = { title: 'Components/Item page/Needs-you card' }
export default meta

export const CardQuestion: StoryObj = { ...Item.CardQuestion, name: 'Question' }
export const CardChecklist: StoryObj = { ...Item.CardChecklist, name: 'Checklist question' }
export const CardBlocked: StoryObj = { ...Item.CardBlocked, name: 'Blocked' }
export const CardProposal: StoryObj = { ...Item.CardProposal, name: 'Proposal' }
export const CardProposedNoWords: StoryObj = { ...Item.CardProposedNoWords, name: 'Proposed, nothing said' }
export const CardQuestionOnProposal: StoryObj = { ...Item.CardQuestionOnProposal, name: 'Question on a proposal' }
export const CardReview: StoryObj = { ...Item.CardReview, name: 'Waits for review' }
export const CardRule: StoryObj = { ...Item.CardRule, name: 'Rule proposed' }
export const CardDecided: StoryObj = { ...Item.CardDecided, name: 'Proposal approved' }
export const CardDecidedPointed: StoryObj = { ...Item.CardDecidedPointed, name: 'Proposal approved, pointer on it' }
export const CardDecidedModify: StoryObj = { ...Item.CardDecidedModify, name: 'Proposal approved, Modify pressed' }
export const CardDeclined: StoryObj = { ...Item.CardDeclined, name: 'Proposal declined' }
export const CardAccepted: StoryObj = { ...Item.CardAccepted, name: 'Work accepted' }
export const CardSentBack: StoryObj = { ...Item.CardSentBack, name: 'Work sent back (Not yet)' }
export const FinishedYouReplied: StoryObj = { ...ItemReplied.FinishedYouReplied, name: 'Finished, you replied' }
export const ProposalYouReplied: StoryObj = { ...ItemReplied.ProposalYouReplied, name: 'Proposal, you replied' }
export const ProposalYouRepliedPointed: StoryObj = {
  ...ItemReplied.ProposalYouRepliedPointed,
  name: 'Proposal, you replied, pointer on Approve',
}
