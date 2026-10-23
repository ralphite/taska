// T457 (#6481): a document: reading it, commenting by writing or by voice, its threads, its form, editing it. Each
// demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Document' } satisfies Meta

/** F01's plan, D1, with comments on it */
const plan = [tap('Tap a feature to open it', 'F1'), tap('Tap its document', 'docOpen')]
/** T09's plan, D4, with a list to tick */
const form = [tap('Tap the task with a plan to tick', 'T9'), tap('Tap its document', 'docOpen')]
const sent = tap('Tap Send', 'send')
const thread = tap('Tap 2: the talk on that paragraph', 'thread', '2')
const pick = tap('Tap a paragraph: your words go to it', 'paragraph', 4)

export const ReadACommentThread = demo({
  steps: [...plan, thread],
  done: 'The paragraph and its comments, with Reply and Resolve',
})

export const CommentOnAParagraph = demo({
  steps: [
    ...plan,
    pick,
    write('Write your comment', W.docComment),
    sent,
    agent('The agent answers on that paragraph', `D1 reply ¶4 ${W.agentDocReply}`),
  ],
  done: 'Your comment and its answer, beside the paragraph',
})

export const CommentByVoice = demo({
  steps: [...plan, pick, tap('Tap the mic', 'mic'), { say: 'Say your comment', speak: 5 }, tap('Tap Send', 'recSend')],
  done: 'Your voice comment, with its words, on that paragraph',
})

export const ReplyToAComment = demo({
  steps: [...plan, thread, tap('Tap Reply', 'replyToComment'), write('Write your reply', W.docReply), sent],
  done: 'Your reply is in that thread',
})

export const ResolveAThread = demo({
  steps: [...plan, thread, tap('Tap Resolve: it is settled', 'resolve')],
  done: 'Resolved: it folds away, and can be opened again',
})

export const EditYourComment = demo({
  steps: [...plan, thread, tap('Tap Edit on your comment', 'editComment', 1), write('Change it', W.dcEdit), sent],
  done: 'Your comment says the new words',
})

export const DeleteACommentThenUndo = demo({
  steps: [...plan, thread, tap('Tap Delete on a comment', 'deleteComment', 1), tap('Tap Undo', 'toastUndo')],
  done: 'It is back',
})

export const TickAListAndSend = demo({
  steps: [
    ...form,
    tap('Tick what you want first', 'tick', 1),
    tap('And this one', 'tick', 3),
    tap('Tap Send: your ticks go into the document and to the agent', 'send'),
  ],
  done: 'Sent: the ticks are in the document, and the agent has them',
})

export const EditTheDocument = demo({
  steps: [
    ...plan,
    tap('Tap Edit', 'docEdit'),
    write('Add a line at the end', `\n\n${W.docEdit}`, 'docText'),
    tap('Tap Save', 'docSave'),
  ],
  done: 'Saved; the comments stay with their paragraphs',
})
