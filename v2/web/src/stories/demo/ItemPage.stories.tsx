// T457 (#6481): an item's page: where it came from, its links, pictures and voice notes, its talk, replying. Each
// demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, whatCameIn, only, open, said, send, sendVoice, speak, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Item page' } satisfies Meta

const answer = [agent('The agent answers: it shows up by itself', `T3 say ${W.agentT3}`), whatCameIn]

export const OpenAnItem = demo({
  steps: [
    open.feature,
    tap('Tap From 4 inputs: your own words it came from', 'sources'),
    tap('Close them', 'closeSheet'),
    tap('Tap T15, one of its subitems', 'link', 'T15'),
    only('phone', tap('Tap Back', 'back')),
    only('desktop', tap('Tap F01 in the list to go back', 'F1')),
  ],
  done: 'Back on F01, where you were',
})

export const ReplyToAnItem = demo({
  steps: [open.task, write('Write to the agent', W.replyT3), send, ...answer],
  done: 'Your reply and its answer, in the talk',
})

export const ReplyByVoice = demo({
  said: said('replyT3'),
  steps: [open.task, ...speak('Say your reply'), sendVoice, ...answer],
  done: 'Your voice note with its words, and the agent answered',
})

export const LookAtAPicture = demo({
  steps: [
    open.screenshot,
    tap('Tap the picture', 'picture', 1),
    tap('Tap to see it at full size', 'zoom'),
    tap('Close it', 'closePicture'),
  ],
  done: 'Back on the item',
})

export const PlayAVoiceNote = demo({
  steps: [open.feature, tap('Tap play on a voice note', 'play', 1), { say: 'Listen' }],
  done: 'It plays your words as you said them',
})

export const ReadAllOfALongMessage = demo({
  steps: [open.stuck, tap('Tap Show more', 'showMore', 'Show')],
  done: 'The whole message',
})

export const FollowALink = demo({
  steps: [open.proposal, tap('Tap D2 in its words: the document it names', 'docLink', 'D2')],
  done: 'The document it names, opened from its code',
})

export const FoldAnAgentsMessage = demo({
  steps: [
    open.stuck,
    tap('Tap ... on its message', 'messageMenu', 1),
    tap('Tap Hide: it folds to one line', 'hideMessage'),
  ],
  done: 'Folded to one line; tap it to read it again',
})
