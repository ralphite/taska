// T457, T522 (R531), B555: an item's talk in every state it has: a message as an agent writes it, as you write it, a
// question in the talk, a comment on one of its documents, the whole talk. Each story is the real page with the item
// open, showing that message: one the demo has, or one a real step makes (an agent writing to the real Taska server in
// the page, Yadong replying, answering, editing), so it is always as the page draws it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'MsgView',
      'MsgText',
      'KindTag',
      'Answered',
      'TakeBack',
      'Pending',
      'PlayIcon',
      'VoiceTime',
      'WordsBar',
      'KeepBtn',
      'SendAnswerBtn',
      'NeedFrame',
      'FromInput',
      'Rich',
      'Thumbs',
      'FileRows',
      'VoiceLine',
      'Talk',
      'DocCard',
      // Pic: a picture with its spinner, or its sign when it cannot load (D82 #8)
      'Pic',
    ],
  },
}
export type Story = StoryObj

const addr = (ref: string) => '/p/' + (ref.includes('/') ? ref : 'shop/' + ref)
const M = (id: number | string) => `#itemTalk [data-mid="${id}"]`
/** The talk's newest message (what a step just added). */
const LAST = '#itemTalk [data-mid]:nth-last-child(1 of [data-mid])'
/** On the way to Taska (lib/outbox.ts): under the latest message. */
const GOING = '#itemTalk div[data-q]'
/** One message of an item's talk on the real page, after these steps. */
const msg = (ref: string, part: Twin['part'], more: Partial<Twin> = {}): Story =>
  place({ at: addr(ref), part, ...more }, more.hover || more.focus ? 'desktop' : undefined)
// F1's two earliest messages are folded under Show 2 earlier
const earlier: Do = { click: '[data-act="more"][data-n="1"]' }
const send: Do = { click: '[data-act="send"]' }
const write = (words: string): Do => ({ type: words, into: '#text' })
const SHOT = '/storybook/fixtures/p__shop__f__f4-shot-cart.png'
const TIP = '#tip'

// ---------------------------------------------------------------- from an agent

// F1: the agent's messages on the export feature; B2 (blocked), B10 (done), B21, F37, T13 (Codex), B36 (organizer)
export const AgentProgress = msg('F1', M(18), { steps: [earlier], live: false })
export const AgentReply = msg('F1', M(22))
/** F450: written to another session of the agent (@worker): its name after the arrow. */
export const AgentToSession = msg('F1', M(258))
/** Pointing at it: its More button shows; the phone has it always. */
export const AgentPointed = msg('F1', M(22), { hover: M(22) })
/** Long and not the latest: on the desktop its first part and Show all; on the phone its first line and Show more. */
export const AgentLong = msg('B2', M(26))
/** Opened with Show all / Show more: whole, and Show less. */
export const AgentLongOpened = msg('B2', M(26), { steps: [{ click: `${M(26)} [data-act="more-msg"]` }], live: false })
/** Pressed: the part you tap to open it dims while your finger is on it. */
export const AgentLongPressed = msg('B2', M(26), { steps: [{ press: `${M(26)} [data-expand]` }], live: false })
/** The latest message of the open item is whole, however long (B360): T43's only one. */
export const AgentLatestWhole = msg('T43', M(265))
/** A finished report: its sections in bold (B10's, done: the talk ends with the card that holds it). */
export const AgentReport = msg('B10', '#itemTalk')
/** With pictures: the agent attaches two of the project's screenshots. */
export const AgentWithPictures = msg('F1', LAST, {
  steps: [
    {
      agent:
        'F1 say files=f4-shot-cart.png,f5-shot-cart2.png \u624b\u673a\u4e0a\u5bfc\u51fa\u524d\u540e\u7684\u4e24\u5f20\u622a\u56fe\u3002',
    },
  ],
})
/** Blocked: once you answered it, the card is gone and the message keeps its tag. */
export const AgentBlocked = msg('B2', M(261), {
  steps: [write('\u6d4b\u8bd5\u5361\u53f7\u653e\u5728 1Password \u7684 Payments \u91cc\u4e86\u3002'), send],
})
/** A proposal, once decided (F37's: you agreed, the agent decided). */
export const AgentProposal = msg('F37', M(234))
export const AgentDecision = msg('F37', M(238))
export const AgentCodex = msg('T13', M(263))
/** What the organizer added from something you said, and where it comes from. */
export const AgentOrganizer = msg('B36', M(224))
/** Hidden from its More menu: one line, Show opens it. */
const hide: Do[] = [
  { point: M(22), on: 'd' },
  { click: `${M(22)} [data-act="msg-menu"]` },
  { click: '[data-act="msg-hide"]' },
]
export const AgentHidden = msg('F1', M(22), { steps: hide })
/** A hidden message opened with Show: whole, with Show again in place of its More button. */
export const AgentHiddenShown = msg('F1', M(22), { steps: [...hide, { click: '[data-act="msg-peek"][data-id="22"]' }] })
/** A document's code in a message (Codex's on T13): pointing at it shows the document's card (F297). */
export const AgentDocCodePointed = msg('T13', [M(263), TIP], { hover: `${M(263)} [data-ref^="D"]` })

// ---------------------------------------------------------------- from you

// F1's #19 (your words, r3), #40 (with a voice note, r4); B6's #267 (your words after its report, r21)
export const YouWords = msg('F1', M(19), { steps: [earlier], live: false })
export const YouVoiceNote = msg('F1', M(40))
/** Your voice note playing: pause, and how far it got. */
const play: Do = { click: `${M(40)} [data-act="play"]` }
export const YouVoicePlaying = msg('F1', M(40), { steps: [play], live: false })
/** A voice note sent while the speech model still works out its words: transcribing, under it. */
export const YouTranscribing = msg('F1', LAST, {
  steps: [{ click: '#sendBtn[data-act="mic"]' }, { wait: 2500 }, { click: '#sendBtn[data-act="rec-send"]' }],
  heard: { working: true },
})
/** Stopped partway: where it stopped, of how long. */
export const YouVoiceStopped = msg('F1', M(40), { steps: [play, { wait: 2500 }, play], live: false })
/** Your words with a picture you pasted into the box. */
export const YouWithPictures = msg('F1', LAST, {
  steps: [{ paste: SHOT }, write('\u8d2d\u7269\u8f66\u90a3\u91cc\u4e5f\u8981\u80fd\u5bfc\u51fa\u3002'), send],
})
/** Long: on the desktop its first part and Show all; the phone shows your words whole. */
export const YouLong = msg('F1', LAST, {
  steps: [
    write(
      '\u5bfc\u51fa\u8fd8\u6709\u51e0\u4ef6\u4e8b\uff1a\u7b2c\u4e00\uff0c\u6587\u4ef6\u540d\u8981\u5e26\u4e0a\u65e5\u671f\u548c\u7b5b\u9009\u6761\u4ef6\uff0c\u6bd4\u5982\u201c\u8ba2\u5355-\u5df2\u4ed8\u6b3e-2026-10-22.csv\u201d\u3002' +
        '\u7b2c\u4e8c\uff0c\u91d1\u989d\u5217\u7528\u4e24\u4f4d\u5c0f\u6570\uff0c\u4e0d\u8981\u5e26\u8d27\u5e01\u7b26\u53f7\uff0c\u8d22\u52a1\u8981\u76f4\u63a5\u5728 Excel \u91cc\u7b97\u3002' +
        '\u7b2c\u4e09\uff0c\u5bfc\u51fa\u5b8c\u4e86\u5728\u9875\u9762\u4e0a\u65b9\u8bf4\u4e00\u58f0\u5bfc\u51fa\u4e86\u591a\u5c11\u884c\uff0c\u8fd9\u6837\u6211\u4e00\u773c\u5c31\u77e5\u9053\u7b5b\u9009\u6709\u6ca1\u6709\u751f\u6548\u3002' +
        '\u7b2c\u56db\uff0c\u5982\u679c\u7b5b\u9009\u540e\u4e00\u884c\u90fd\u6ca1\u6709\uff0c\u5c31\u4e0d\u8981\u751f\u6210\u7a7a\u6587\u4ef6\u4e86\uff0c\u76f4\u63a5\u63d0\u793a\u201c\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u8ba2\u5355\u201d\u3002',
    ),
    send,
  ],
})
const edit = (n: number, rid: string, words: string): Do[] => [
  { click: `${M(n)} [data-act="input-more"][data-id="${rid}"]` },
  { click: '[data-act="input-pick"][data-pick="input-edit"]' },
  write(words),
  send,
]
/** Edited before the agent read it (B6's last words): when, and the earlier words a tap away. */
export const YouEdited = msg('B6', M(267), {
  steps: edit(
    267,
    'r21',
    '\u987a\u4fbf\u770b\u4e00\u4e0b B6 \u7684\u90ae\u4ef6\u95ee\u9898\uff0c\u5ba2\u670d\u8bf4\u4eca\u5929\u4e0a\u5348\u53c8\u6709\u4e24\u4e2a\u987e\u5ba2\u6536\u5230\u4e86\u4e24\u5c01\u3002',
  ),
})
/** Changed after the agent read it (F1's #40, answered since): the earlier version, faded, above the words as they are now. */
export const YouEarlierVersion = msg('F1', M(40), {
  steps: edit(
    40,
    'r4',
    '\u65e5\u671f\u683c\u5f0f\u7528\u8bbe\u7f6e\u91cc\u9009\u7684\u90a3\u4e2a\uff0c\u5bfc\u51fa\u548c\u9875\u9762\u4e0a\u4e00\u6837\u3002',
  ),
})
/** Details added to what you said: only what was added, under the first words. */
export const YouAddedDetails = msg('F1', M(40), {
  steps: [
    { click: `${M(40)} [data-act="input-more"][data-id="r4"]` },
    { click: '[data-act="input-pick"][data-pick="input-append"]' },
    write('\u65e5\u671f\u5217\u4e5f\u4e00\u6837\u3002'),
    send,
  ],
})
/** Your last words, read by the agent, no answer yet. */
export const YouReadByAgent = msg('B6', M(267), { steps: [{ read: '/B6' }] })
/** Pointing at Read by: who read it, and when. */
export const YouReadByPointed = msg('B6', [M(267), TIP], { steps: [{ read: '/B6' }], hover: `${M(267)} span[title]` })
/** An item's code in your words: pointing at it shows the item's card (r368). */
export const YouItemCodePointed = msg('B6', [M(267), TIP], { hover: `${M(267)} [data-ref^="B"]` })
/** Just sent and in: Undo takes it back for a few seconds (then it is gone, as on the page). */
export const YouJustSent = msg('B6', LAST, {
  steps: [write('\u597d\u7684\uff0c\u6211\u95ee\u4e00\u4e0b\u5ba2\u670d\u3002'), send],
})
/** Its input moved to another project after you added to it: its first words go with it (store.py "moved"), what you
 * added stays, with no More button of its own, and the voice note keeps Original words. */
const ADDED = '#itemTalk [data-mid][data-src="r4"]'
const moved: Do[] = [
  { click: `${M(40)} [data-act="input-more"][data-id="r4"]` },
  { click: '[data-act="input-pick"][data-pick="input-append"]' },
  write('\u65e5\u671f\u5217\u4e5f\u4e00\u6837\u3002'),
  send,
  { wait: 1500 },
  { click: `${ADDED} [data-act="input-more"][data-id="r4"]` },
  { click: '[data-act="input-pick"][data-pick="move-input"]' },
  { click: '[data-act="move-input-to"][data-to="mobile-app"]' },
]
export const YouMoved = msg('F1', ADDED, { steps: moved })
/** The pointer on its voice note: Original words floats to its left, clear of your words (F364, T529). */
export const YouMovedVoicePointed = msg('F1', ADDED, { steps: moved, hover: `${ADDED} .group\\/voice` })
// what you sent to this item and Taska does not have yet (B440), under the item's latest message (T13: Codex's)
const pending = write('\u624b\u673a\u4e0a\u7684\u95ee\u9898\u4f18\u5148\u5904\u7406')
const op = '^/p/shop/api/op'
export const YouSending = msg('T13', GOING, { steps: [pending, send], net: { [op]: 'hang' } })
export const YouUploading = msg('T13', GOING, {
  steps: [{ paste: SHOT }, pending, send],
  net: { [op]: 'hang', '^/p/shop/api/file': 'hang' },
})
/** Taska out of reach: it goes by itself when Taska answers. */
export const YouWaitingForTaska = msg('T13', GOING, { steps: [pending, send], net: { [op]: 'down' } })
/** Taska said no: Retry, or Edit to take it back into the box. */
export const YouNotSent = msg('T13', GOING, { steps: [pending, send], net: { [op]: 'no' } })

// ---------------------------------------------------------------- a question in the talk

// T7: one answer; T9: several (a checklist); T38: a question with no choices, taken back; Mobile app's I5: a proposal's
const pick = (n: number, ...i: number[]): Do[] => [
  ...i.map((k) => ({ click: `[data-act="choice"][data-n="${n}"][data-i="${k}"]` })),
  { click: `[data-act="choice-send"][data-n="${n}"]` },
]
/** Answered: your pick ticked, Submitted where the buttons were; on the desktop Modify shows under the pointer. */
export const AskAnswered = msg('T7', M(260), { steps: pick(7, 0) })
export const AskAnsweredPointed = msg('T7', M(260), { steps: pick(7, 0), hover: M(260) })
export const AskChecklistAnswered = msg('T9', M(254), { steps: pick(9, 0, 1) })
/** You wrote back instead of picking: Skipped, and Answer to pick after all. */
export const AskSkipped = msg('T7', '#itemTalk', {
  steps: [write('\u4e24\u79cd\u90fd\u8981\uff0c\u5bfc\u51fa\u65f6\u8ba9\u6211\u9009\u3002'), send],
})
/** Modify: the card asks again, your pick still ticked, Cancel or Send answer. */
const modify: Do = { click: `${M(260)} [data-act="ask-modify"]` }
export const AskModifying = msg('T7', M(260), { steps: [...pick(7, 0), modify] })
/** A changed answer on its way while Taska is out of reach: the new pick ticked, until Taska has it. */
export const AskAnswerGoing = msg('T7', M(260), {
  steps: [...pick(7, 0), modify, { online: false }, ...pick(7, 1)],
})
/** The question of a proposal, answered: Approve waits quietly beside Submitted (B485). */
export const AskAnsweredApprove = msg('mobile-app/I5', '#itemTalk', { steps: pick(5, 0) })
/** Approve under the pointer: a button again. */
export const AskAnsweredApprovePointed = msg('mobile-app/I5', '#itemTalk', {
  steps: pick(5, 0),
  hover: '#itemTalk [data-act="status"]',
})
/** Not answered, asked again later: the older one stays a message, tagged Question. */
export const AskNotAnswered = msg('T7', '#itemTalk', {
  steps: [
    {
      agent:
        'T7 ask \u5bfc\u51fa\u683c\u5f0f\u8fd8\u6ca1\u5b9a\uff0c\u5148\u505a\u54ea\u4e2a\uff1f\n  - ( ) CSV\n  - ( ) Excel\uff08.xlsx\uff09',
    },
  ],
})
/** A question with no choices, answered by your words: Submitted on it. */
export const AskPlainAnswered = msg('T3', '#itemTalk', {
  steps: [
    { agent: 'T3 ask \u9000\u8d27\u653f\u7b56\u9875\u653e\u5728\u54ea\u4e2a\u83dc\u5355\u4e0b\uff1f' },
    write('\u653e\u5728\u5e2e\u52a9\u4e2d\u5fc3\u4e0b\u9762\u3002'),
    send,
  ],
})
/** Taken back by the agent: the question struck through, and the line that says so. */
export const AskTakenBack = msg('T38', '#itemTalk')

// ---------------------------------------------------------------- a comment on a document, in the talk

/** One comment of F1's document (D1), as the talk shows it among the messages (T274 #4, B436, B477). */
const note = (id: number) => msg('F1', `#itemTalk [data-cid="${id}"]`, { steps: [earlier], live: false })
/** Yours: what it is about, quoted at its top (it opens that place), and where. */
export const CommentYours = note(23)
export const CommentAgent = note(24)
/** On the whole document: no quote. */
export const CommentWholeDoc = note(27)
/** About a table: the quote reads as words. */
export const CommentOnTable = note(28)
/** Said about a paragraph of D1 with its own mic (the same button stops it: on the phone that posts it, on the desktop
 * it waits in the box for Comment), the speech model heard no words: the voice note alone, as the talk shows it once
 * the document is closed. */
const PARA = '#docBlocks > section:nth-child(2)'
export const CommentVoice = msg('F1', '#itemTalk [data-cid]:has([data-act="play"])', {
  at: '/p/shop/D1',
  steps: [
    { point: PARA, on: 'd' },
    { click: PARA, on: 'p' }, // the phone: a tap picks the paragraph, its mic under it
    { click: '[data-act="doc-say"]' },
    { wait: 2500 },
    { click: '[data-act="doc-say"]' },
    { wait: 1500 },
    { click: '#sendBtn[data-act="send"]', on: 'd' }, // the desktop: the note waits in the box, Comment posts it
    { wait: 1500, on: 'd' },
    { click: '[data-act="doc-close"]', on: 'd' },
    { click: '[data-act="close"]', on: 'p' },
  ],
  heard: { tr: '' },
})

// ---------------------------------------------------------------- the whole talk

/** F1: every message, its document's comments among them in time (T274 #4), on a screen tall enough for all. */
export const WholeTalk = msg('F1', '#itemTalk', { steps: [earlier], live: false, height: 2600 })
/** B35: a long back-and-forth, on a screen tall enough for all of it. */
export const LongTalk = msg('B35', '#itemTalk', { height: 3200 })
/** T7: what waits on you is its card, in the place of its message (T438 #12). */
export const WithItsCard = msg('T7', '#itemTalk')

// ---------------------------------------------------------------- parts

/** Markdown in a message: a table, code, a long address (an agent writes it). */
export const Markdown = msg('F1', LAST, {
  steps: [
    {
      agent:
        'F1 say \u5bfc\u51fa\u7684\u5217\uff1a\n  | \u5217 | \u683c\u5f0f |\n  | --- | --- |\n  | \u91d1\u989d | 1234.50 |\n  | \u65e5\u671f | 2026/10/22 |\n  \u7528 `exportRows()` \u5199\u6587\u4ef6\uff0c\u5730\u5740\uff1ahttps://example.com/orders?status=paid&from=2026-10-01&to=2026-10-31&columns=amount,date,customer',
    },
  ],
})
/** The pointer on a voice note: Original words floats above it (F364). */
export const VoiceChipPointed = msg('F1', M(40), { hover: `${M(40)} .group\\/voice` })
/** The item's documents: its plan (F1's D1). */
const DOC = '#detailView [data-act="doc-open"]'
export const DocumentCard = msg('F1', DOC)
export const DocumentCardPointed = msg('F1', DOC, { hover: DOC })
