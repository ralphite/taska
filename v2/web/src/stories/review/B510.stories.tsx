// B510 (#6652, #6676): an item that is finished and waits for Yadong to accept, and also asks him a question. Both
// cases are data, played on the real page (../demo/demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, tap, whatCameIn } from '../demo/demo'
import { W } from '../demo/words'

export default { title: 'Review/B510 Finished and asks you' } satisfies Meta

const task = tap('Tap the task the agent finished', 'T3')
const answer = [tap('Pick an answer', 'choice', 1), tap('Tap Send answer', 'sendAnswer')]
const accept = tap('Tap Accept', 'accept')

/** As the page is now: the agent finished, then asked. One card waits for Yadong: the question, with Accept beside
 * Send answer; the finished work is a plain message above it. */
export const NowOneCard = demo({
  before: `T3 done ${W.agentDone}\nT3 ask ${W.askT3}`,
  steps: [
    task,
    { ...whatCameIn, say: 'One card: the question, with Accept beside Send answer' },
    ...answer,
    { say: 'Answered: the card says Submitted, and Accept is still there, quieter' },
    accept,
  ],
  done: 'Now: one card asks and offers Accept at the same time',
})

/** Option 1 of #6652, only as far as the page can show it today: the agent asks first and finishes after the
 * answer, so the accept card comes after. The page itself does not hold an accept card back while a question is
 * open: for that, option 1 needs a change in the page. */
export const Option1AskFirstThenFinish = demo({
  before: `T3 ask ${W.askT3}`,
  steps: [
    task,
    { ...whatCameIn, say: 'Only the question, no Accept yet: the agent has not finished' },
    ...answer,
    agent('After your answer the agent finishes: now the accept card comes', `T3 done ${W.agentDone}`),
    { ...whatCameIn, say: 'Its own card, Finished: Not yet or Accept, under your answer' },
    accept,
  ],
  done: 'Option 1 as the agent can do it today; the page holding the card back needs a change',
})
