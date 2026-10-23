// T457 (#6481): a document: reading it, commenting by writing or by voice, its threads, its form, editing it. Each
// demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { agent, demo, open, said, select, send, sendVoice, speak, tap, undo, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Document' } satisfies Meta

const doc = tap('Tap its document', 'docOpen')
/** F01's plan, D1, with comments on it */
const plan = [open.feature, doc]
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

// T553 (r778): the choices in a document, guided: each tap waits for yours where the mark breathes, and the desktop
// shows only the item's pane, its document and the box under it, not the whole screen (B524: the box's line sends
// the ticks, with what is written in the box as their note)
const choices = { guided: true, path: '/p/shop/T9', focus: { desktop: ['#detailView', '#foot'] } } as const
const sendChoices = tap('Tap Send choices, in the line over the box: the ticks go', 'sendChoices')

export const TickAListAndSend = demo({
  ...choices,
  steps: [
    doc,
    tap('Tick what you want first', 'tick', 1),
    tap('And this one: the line over the box says 2 choices not sent', 'tick', 3),
    sendChoices,
  ],
  done: 'Sent: the ticks are in the document, and the agent has them as one reply',
})

export const AddANoteToYourChoices = demo({
  ...choices,
  steps: [
    doc,
    tap('Tick one', 'tick', 2),
    write('Write a note in the box', W.noteT7),
    tap('Tap Send choices: the note goes with them', 'sendChoices'),
  ],
  done: 'The agent has your ticks and your note, in one reply; the box is empty again',
})

export const TicksWaitUntilSent = demo({
  ...choices,
  steps: [
    doc,
    tap('Tick one: it waits in the document until you send it', 'tick', 1),
    tap('Go back to the item: its card for the document says 1 choice not sent', 'docBack'),
    tap('Open the document again: your tick is still there', 'docOpen'),
    sendChoices,
  ],
  done: 'Nothing ticked is lost: it waits, said on the document and its card, until you send it',
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
  ...choices,
  steps: [
    doc,
    tap('Tick one', 'tick', 1),
    sendChoices,
    tap('Changed your mind? Tap Modify', 'tickAgain'),
    tap('Tick another', 'tick', 2),
    tap('Tap Send choices again', 'sendChoices'),
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
