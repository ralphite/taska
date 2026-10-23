// T457 (#6481): the agent's side, as it shows on the page: who is here, its question, its finished work, what it has
// read. The agent writes real commands to Taska (the /agent language). Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, whatCameIn, open, tap } from './demo'
import { W } from './words'

export default { title: 'Demo/Agents' } satisfies Meta

const task = open.task

export const WhoIsHere = demo({
  steps: [tap('Tap the agent at the top: who is here, and what it does', 'agentInfo')],
  done: 'Each agent and its session, and when it was last here',
})

export const TheAgentAsks = demo({
  steps: [task, agent('The agent asks you something', `T3 ask ${W.agentAsks}`), whatCameIn],
  done: 'Its question waits for you, in Needs you too',
})

export const TheAgentFinishes = demo({
  steps: [task, agent('The agent finishes and says what it did', `T3 done ${W.agentDone}`), whatCameIn],
  done: 'It waits for you to accept',
})

export const TheAgentReadsYourReply = demo({
  steps: [
    tap('Tap the bug you replied on', 'B6'),
    { say: 'The agent reads it', read: '/B6' },
    agent('And answers', `B6 say ${W.agentB6Reply}`),
    whatCameIn,
  ],
  done: 'Read, and answered',
})
