// T457 (#6481): what waits on you, decided, answered, or replied to instead: each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, needsYou, whatCameIn, open, said, send, sendVoice, speak, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Needs you' } satisfies Meta

/** B06 is finished, and you replied on it before: the agent says it is done again, so it waits for you to accept */
const doneAgain = 'B6 done'

export const ApproveAProposal = demo({
  steps: [
    needsYou,
    open.proposal,
    tap('Tap Approve: the agent can start', 'approve'),
    agent('The agent starts: its words come in by themselves', `I4 doing\nI4 progress ${W.agentI4Start}`),
  ],
  done: 'Approved: it is in progress, and the agent said how it starts',
})

export const ApproveFromTheList = demo({
  steps: [needsYou, tap('Tap Approve on the row itself: no need to open it', 'rowApprove')],
  done: 'Approved from the list: it leaves Needs you, with Undo for a few seconds',
})

export const SayWontDoToAProposal = demo({
  steps: [
    needsYou,
    tap('Tap the feature the agent proposed', 'F11'),
    tap("Tap Won't do: nobody works on it", 'wontDo'),
  ],
  done: "Won't do: it is closed, with Undo for a few seconds",
})

export const ApproveARule = demo({
  steps: [
    needsYou,
    tap('Tap the rule the agent proposed', 'R17'),
    tap('Tap Approve: agents follow it from now on', 'approve'),
  ],
  done: 'The rule is in force',
})

export const AcceptFinishedWork = demo({
  before: doneAgain,
  steps: [open.finished, tap('Read what it did, then tap Accept', 'accept')],
  done: 'Accepted: it is done',
})

export const AcceptThenChangeYourMind = demo({
  before: doneAgain,
  steps: [
    open.finished,
    tap('Tap Accept', 'accept'),
    tap('Changed your mind? Tap Modify on the card', 'modifyDecision'),
    tap('Tap Not yet: the work goes back to the agent', 'notYet'),
    agent('The agent hears it and goes on', `B6 progress ${W.agentB6Again}`),
    whatCameIn,
  ],
  done: 'Not done after all: it is back in progress',
})

export const ReplyInsteadOfApproving = demo({
  steps: [
    needsYou,
    open.proposal,
    write('Do not decide yet: write what you think', W.replyI4),
    tap('Tap Send: the card says Skipped · you replied, with Approve beside it', 'send'),
    agent('The agent answers', `I4 say ${W.agentI4Reply}`),
    whatCameIn,
  ],
  done: 'The agent answered: its proposal waits for you again',
})

export const ReplyInsteadOfAccepting = demo({
  before: doneAgain,
  steps: [
    open.finished,
    write('Not sure it is fixed: say what you saw', W.replyB6),
    tap('Tap Send: the card says Skipped · you replied, with Accept beside it', 'send'),
    agent('The agent looks again and answers', `B6 say ${W.agentB6Reply}`),
    whatCameIn,
  ],
  done: 'The agent answered: the work waits for you to accept again',
})

export const AnswerAQuestion = demo({
  steps: [
    needsYou,
    open.question,
    tap('Pick one answer', 'choice', 2),
    tap('Tap Send answer', 'sendAnswer'),
    agent('The agent goes on with your answer', `T7 progress ${W.agentT7}`),
  ],
  done: 'Answered: your pick is on the card, and the agent took it',
})

export const AnswerWithAFewWords = demo({
  steps: [
    needsYou,
    open.question,
    tap('Pick one answer', 'choice', 2),
    write('Add a few words to it', W.noteT7),
    tap('Tap Send answer: the pick and the words go together', 'sendAnswer'),
  ],
  done: 'Your pick and your words went to the agent as one answer',
})

export const AnswerAChecklist = demo({
  steps: [
    needsYou,
    open.checklist,
    tap('Tick the first', 'choice', 1),
    tap('And the third', 'choice', 3),
    tap('Tap Send answer', 'sendAnswer'),
    agent('The agent goes on with what you ticked', `T9 progress ${W.agentT9}`),
  ],
  done: 'Answered: both ticks went to the agent',
})

export const ChangeAnAnswer = demo({
  steps: [
    needsYou,
    open.question,
    tap('Pick one answer', 'choice', 1),
    tap('Tap Send answer', 'sendAnswer'),
    tap('Changed your mind? Tap Modify', 'modifyAnswer'),
    tap('Pick another one', 'choice', 3),
    tap('Tap Send answer again', 'sendAnswer'),
  ],
  done: 'The new answer is the one that counts',
})

export const UnblockTheAgent = demo({
  steps: [
    needsYou,
    open.stuck,
    write('Give it what it needs', W.answerB2),
    send,
    agent('The agent is unblocked and goes on', `B2 progress ${W.agentB2}`),
    whatCameIn,
  ],
  done: 'The agent has what it needed: it no longer waits on you',
})

export const AnswerByVoice = demo({
  said: said('answerB2'),
  steps: [needsYou, open.stuck, ...speak('Say your answer'), sendVoice, whatCameIn],
  done: 'Your voice note is on the item, with its words',
})
