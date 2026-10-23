// T457 (#6481): a document: reading it, commenting by writing or by voice, its threads, its form, editing it. Each
// demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, open, said, select, send, sendVoice, speak, tap, undo, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Document' } satisfies Meta

const doc = tap('Tap its document', 'docOpen')
/** F01's plan, D1, with comments on it */
const plan = [open.feature, doc]
/** T09's plan, D4, with a list to tick */
const form = [open.checklist, doc]
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
    send,
    agent('The agent answers on that paragraph', `D1 reply ¶4 ${W.agentDocReply}`),
  ],
  done: 'Your comment and its answer, on that paragraph',
})

export const CommentByVoice = demo({
  said: said('docComment'),
  steps: [...plan, pick, ...speak('Say your comment'), sendVoice],
  done: 'Your voice comment, with its words, on that paragraph',
})

export const ReplyToAComment = demo({
  steps: [...plan, thread, tap('Tap Reply', 'replyToComment'), write('Write your reply', W.docReply), send],
  done: 'Your reply is in that thread',
})

export const ResolveAThread = demo({
  steps: [...plan, thread, tap('Tap Resolve: it is settled', 'resolve')],
  done: 'Resolved: it folds away, and can be opened again',
})

export const EditYourComment = demo({
  steps: [...plan, thread, tap('Tap Edit on your comment', 'editComment', 1), write('Change it', W.dcEdit), send],
  done: 'Your comment says the new words',
})

export const DeleteACommentThenUndo = demo({
  steps: [...plan, thread, tap('Tap Delete on a comment', 'deleteComment', 1), undo],
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

export const CommentOnSelectedWords = demo({
  steps: [
    ...plan,
    select('Select a few words', W.selWords, 'paragraph', 4),
    write('Write about them', W.selComment),
    send,
  ],
  done: 'Your comment quotes the words you picked',
})

export const CommentOnTheWholeDocument = demo({
  on: 'phone',
  steps: [...plan, tap('Tap Comment on the whole document', 'wholeDoc'), write('Write it', W.wholeDoc), send],
  done: 'A comment on the document as a whole',
})

export const MoveACommentToAnotherParagraph = demo({
  steps: [
    ...plan,
    thread,
    tap('Tap Move on a comment', 'moveComment', 1),
    tap('Pick the paragraph it is about', 'commentTo', 5),
  ],
  done: 'The comment sits on the paragraph it is about',
})

export const ChangeYourTicks = demo({
  steps: [
    ...form,
    tap('Tick one', 'tick', 1),
    send,
    tap('Changed your mind? Tap Modify', 'tickAgain'),
    tap('Tick another', 'tick', 2),
    tap('Tap Send again', 'send'),
  ],
  done: 'The document and the agent have your new ticks',
})

export const MoveADocument = demo({
  steps: [...plan, tap('Tap Move', 'docMove'), tap('Pick the item it belongs to', 'docTo', 'T15')],
  done: 'It is on T15 now',
})

export const DeleteADocument = demo({
  steps: [...plan, tap('Tap Delete', 'docDelete'), { ...tap('Tap it again to be sure', 'docDelete'), soon: true }],
  done: 'Gone from the item; it waits in Deleted',
})
