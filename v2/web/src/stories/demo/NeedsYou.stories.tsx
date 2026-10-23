// T457 (#6481): what waits on you, decided, answered, or replied to instead: each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Needs you' } satisfies Meta

/** From the list, only what waits on you, then one of them. */
const open = (code: Parameters<typeof tap>[1], what: string) => [
  tap('Tap Needs you: only what waits on you', 'needsYou'),
  tap(`Tap ${what}`, code),
]
const sent = tap('Tap Send', 'send')
const finished = tap('Tap the bug the agent finished: it waits for you to accept', 'B6')

export const ApproveAProposal = demo({
  steps: [
    ...open('I4', 'the idea the agent proposed'),
    tap('Tap Approve: the agent can start', 'approve'),
    agent('The agent starts: its words come in by themselves', `I4 doing\nI4 progress ${W.agentI4Start}`),
  ],
  done: 'Approved: it is in progress, and the agent said how it starts',
})

export const ApproveFromTheList = demo({
  steps: [
    tap('Tap Needs you: only what waits on you', 'needsYou'),
    tap('Tap Approve on the row itself: no need to open it', 'rowApprove'),
  ],
  done: 'Approved from the list: it leaves Needs you, with Undo for a few seconds',
})

export const SayWontDoToAProposal = demo({
  steps: [...open('F11', 'the feature the agent proposed'), tap("Tap Won't do: nobody works on it", 'wontDo')],
  done: "Won't do: it is closed, with Undo for a few seconds",
})

export const ApproveARule = demo({
  steps: [...open('R17', 'the rule the agent proposed'), tap('Tap Approve: agents follow it from now on', 'approve')],
  done: 'The rule is in force',
})

export const AcceptFinishedWork = demo({
  steps: [finished, tap('Read what it did, then tap Accept', 'accept')],
  done: 'Accepted: it is done',
})

export const AcceptThenChangeYourMind = demo({
  steps: [
    finished,
    tap('Tap Accept', 'accept'),
    tap('Changed your mind? Tap Modify on the card', 'modifyDecision'),
    tap('Tap Not yet: the work goes back to the agent', 'notYet'),
    agent('The agent hears it and goes on', `B6 progress ${W.agentB6Again}`),
  ],
  done: 'Not done after all: it is back in progress',
})

export const ReplyInsteadOfApproving = demo({
  steps: [
    ...open('I4', 'the idea the agent proposed'),
    write('Do not decide yet: write what you think', W.replyI4),
    tap('Tap Send: the card says Skipped · you replied, with Approve beside it', 'send'),
    agent('The agent answers', `I4 say ${W.agentI4Reply}`),
  ],
  done: 'The agent answered: its proposal waits for you again',
})

export const ReplyInsteadOfAccepting = demo({
  steps: [
    finished,
    write('Not sure it is fixed: say what you saw', W.replyB6),
    tap('Tap Send: the card says Skipped · you replied, with Accept beside it', 'send'),
    agent('The agent looks again and answers', `B6 say ${W.agentB6Reply}`),
  ],
  done: 'The agent answered: the work waits for you to accept again',
})

export const AnswerAQuestion = demo({
  steps: [
    ...open('T7', 'the question the agent asked'),
    tap('Pick one answer', 'choice', 2),
    tap('Tap Send answer', 'sendAnswer'),
    agent('The agent goes on with your answer', `T7 progress ${W.agentT7}`),
  ],
  done: 'Answered: your pick is on the card, and the agent took it',
})

export const AnswerWithAFewWords = demo({
  steps: [
    ...open('T7', 'the question the agent asked'),
    tap('Pick one answer', 'choice', 2),
    write('Add a few words to it', W.noteT7),
    tap('Tap Send answer: the pick and the words go together', 'sendAnswer'),
  ],
  done: 'Your pick and your words went to the agent as one answer',
})

export const AnswerAChecklist = demo({
  steps: [
    ...open('T9', 'the question with a list to tick'),
    tap('Tick the first', 'choice', 1),
    tap('And the third', 'choice', 3),
    tap('Tap Send answer', 'sendAnswer'),
    agent('The agent goes on with what you ticked', `T9 progress ${W.agentT9}`),
  ],
  done: 'Answered: both ticks went to the agent',
})

export const ChangeAnAnswer = demo({
  steps: [
    ...open('T7', 'the question the agent asked'),
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
    ...open('B2', 'the bug where the agent is stuck'),
    write('Give it what it needs', W.answerB2),
    sent,
    agent('The agent is unblocked and goes on', `B2 progress ${W.agentB2}`),
  ],
  done: 'The agent has what it needed: it no longer waits on you',
})

export const AnswerByVoice = demo({
  steps: [
    ...open('B2', 'the bug where the agent is stuck'),
    tap('Tap the mic and say your answer', 'mic'),
    { say: 'Speak: the waves follow your voice', speak: 5 },
    tap('Tap Send: it is sent as soon as its words are in', 'recSend'),
  ],
  done: 'Your voice note is on the item, with its words',
})

export const GoThroughWhatNeedsYou = demo({
  steps: [
    tap('Tap Needs you', 'needsYou'),
    tap('Tap Go through: one at a time', 'goThrough'),
    tap('Not now: go on to the next one', 'goNext'),
    tap('This one too', 'goNext'),
    tap('And this one', 'goNext'),
    tap('A proposal: approve it here', 'goApprove'),
    tap('Done for now: tap End', 'goEnd'),
  ],
  done: 'Back to the list: what you decided has left Needs you',
})
