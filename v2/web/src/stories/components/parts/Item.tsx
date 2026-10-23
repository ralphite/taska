// T457: an item's pane (the right side on the desktop, the whole page on the phone) in every state an item has, and
// the card that asks you, on its own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { looksOf } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'DetailView',
      'ItemPage',
      'ItemHead',
      'ItemActs',
      'ItemNav',
      'BarIcon',
      'BarText',
      // NoSelection: the item pane with no item to show (a link to an item that is not there, the page still loading)
      'NoSelection',
      // Missing: an item or document the address names, still loading or not in this project (D77 #1 #2)
      'Missing',
      'Editor',
      'Inline',
      'SectionHead',
      'NeedsCard',
      'ItemTalk',
    ],
  },
}
export type Story = StoryObj

/** An item's or a document's address: in Shop, or "mobile-app/B1" in another project. */
const addr = (ref: string) => '/p/' + (ref.includes('/') ? ref : 'shop/' + ref)
/** B555: the real page with this item open: its pane (and its box), or on the phone its page; then these steps. */
const at = (ref: string, steps?: Do[], more?: Partial<Twin>): Story => ({
  parameters: { taska: { page: { at: addr(ref), part: ['#detailView', '#foot'], steps, ...more } } },
  render: () => <></>,
})
/** A story of the desktop only (what the phone does not have). */
const desk = (s: Story): Story => ({ ...s, parameters: { ...s.parameters, platform: 'desktop' } })

export const InProgressWithTalk = at('F1')
/** An agent is blocked and needs you: the amber card at the end of the talk, and its status reads Needs you (R055,
 * B535), though it is still in progress (its menu ticks that). */
export const Blocked = at('B2')
/** An agent asks you: its status reads Needs you too, while it is open. */
export const Question = at('T7')
/** A question with several answers you can tick, and its plan as a document. */
export const ChecklistQuestion = at('T9')
/** B524 (r736): a choice ticked in its document and not sent yet: the document's card in Documents says so. */
export const DocumentChoicesNotSent = at('D4', [
  { click: '[data-act="doc-tick"]' },
  { click: '[data-act="doc-close"]', on: 'd' },
  { click: '[data-act="close"]', on: 'p' },
])
/** An idea the agent proposed, with a web page preview and its proposal. */
export const ProposedWithPreview = at('I4')
/** Proposed, nothing said yet. */
export const ProposedEmpty = at('F11')
/** Finished by the agent, waiting for you: Not yet or Accept (Mobile app's B1: its report is the last word). */
export const WaitsForReview = at('mobile-app/B1')
export const Done = at('B10')
export const WontDo = at('T5')
export const Open = at('T3')
export const Later = at('F8')
export const Subitem = at('T14')
/** A parent: its subitems, its plan document, two agents at work. */
export const WithSubitemsAndDocument = at('T12')
/** B532 (r760): its only subitem put in Later, which the list's Active view does not show: marked Later. On the
 * desktop at full width (O), so the item, down to its subitems, is in view beside its talk. */
export const SubitemInLater = at('T13', [
  { click: '#detailView [data-f="when"][title]:not(#dActs *)' },
  { click: '#detailView [data-act="goto"][data-n="12"]' },
  { key: 'o', on: 'd' },
])
export const RuleInForce = at('R16')
export const RuleProposed = at('R17')
/** A long talk (17 messages), the item finished. */
export const LongTalk = at('B35')
/** The agent asked, then took its question back. */
export const QuestionWithdrawn = at('T38')
/** A proposal you approved: the card says what you decided. */
export const Decided = at('I4', [{ click: '[data-act="status"][data-v="open"]' }])
export const WithPictures = at('B36')
export const Archived = at('B21')
/** Opened from its link while the page waits for Taska's first answer (a reload). */
export const Loading = at('T7', undefined, { net: { '^/(p|api)/': 'hang' }, part: '#app' })
/** Its link names an item the project does not have (T99). */
export const NotThere = at('T99')
/** Editing the title, details and next step. */
export const Editing = at('T3', [{ click: '#itemMenuBtn' }, { click: '[data-act="edit"]' }])
/** Adding the first subitem: Add pressed, its title box open (an item short enough that the box is in sight above
 * the line, as the page scrolls it into sight). */
export const AddingSubitem = at('T38', [{ click: '#itemMenuBtn' }, { click: '[data-act="sub-new"]' }])
/** The line between the item and its talk, pointed at: it turns blue, to drag (desktop). */
export const LinePointed = desk(at('T3', undefined, { hover: '[data-grip="top"]' }))
/** Full width (O): the list makes room; an item that fits stays in one column (desktop). */
export const FullWidth = desk(at('T3', [{ key: 'o' }]))
/** Full width: the item (its body, subitems, document) beside its talk, one line between them from the top to the
 * bottom, the box under the talk (desktop, B495). */
export const TwoColumns = desk(at('F1', [{ key: 'o' }]))
/** Your words on their way to the item, before Taska has them. */
export const ReplySending = at(
  'F1',
  [
    { type: '\u624b\u673a\u4e0a\u7684\u95ee\u9898\u4f18\u5148\u5904\u7406', into: '#text' },
    { click: '[data-act="send"]' },
  ],
  { net: { '^/p/shop/api/op': 'hang' }, part: ['#detailView div[data-q]', '#foot'] },
)
/** The item pane while the list column shows Documents and none is picked (desktop). */
export const NothingPicked = desk({
  parameters: { taska: { page: { at: '/p/shop/docs', part: ['#detailView', '#foot'] } } },
  render: () => <></>,
})

// ---------------------------------------------------------------- the card that asks you, alone

/** B555: the card in the item's talk, on the real page, after these steps. */
const card = (ref: string, steps?: Do[], more?: Partial<Twin>): Story => ({
  parameters: { taska: { page: { at: addr(ref), part: CARD, steps, ...more } } },
  render: () => <></>,
})
const CARD = '#detailView section.w-full.rounded-2xl.border'
export const CardQuestion = card('T7')
export const CardChecklist = card('T9')
export const CardBlocked = card('B2')
export const CardProposal = card('I4')
export const CardProposedNoWords = card('F11')
export const CardRule = card('R17')
/** Finished work waiting for you (Mobile app's B1). */
export const CardReview = card('mobile-app/B1')
export const CardAccepted = card('mobile-app/B1', [{ click: '[data-act="status"][data-v="done"]' }])
/** Finished work you sent back with Not yet: the agent has it again. */
export const CardSentBack = card('mobile-app/B1', [{ click: '[data-act="reopen"]' }])
/** A question on an idea still proposed (Mobile app's I5): Approve stays one tap away beside the answer (B299). */
export const CardQuestionOnProposal = card('mobile-app/I5')
const approve = { click: '[data-act="status"][data-v="open"]' }
export const CardDecided = card('I4', [approve])
/** Approved, pointed at: Modify shows (on the phone it always shows). */
export const CardDecidedPointed = desk(card('I4', [approve], { hover: CARD }))
/** Approved, then Modify: the two buttons work again; the one you chose before closes it, as Cancel does. */
export const CardDecidedModify = card('I4', [approve, { click: '[data-act="decided-modify"]' }])
/** A proposal you declined. */
export const CardDeclined = card('I4', [{ click: '[data-act="status"][data-v="dropped"]' }])
// ---------------------------------------------------------------- under the pointer, the keyboard, pressed, busy
// T522 (r731, r762): every look of the item pane's head, its chips and its subitems side by side, each the real page
// with F01 open and the pointer, a key or a press on it. The desktop only.
const HEAD = ['#dHead', '#dNav', '#itemTop'],
  DONE = '#dActs > button:first-child',
  SUBS = '#detailBody section:has([data-act="sub-new"])',
  SUB = `${SUBS} .divide-y > button[data-act="goto"]:first-child`
const tipped = (sel: string) => ({ part: [...HEAD, '#tip'], hover: sel })
export const HeadLooks: Story = looksOf({ at: addr('F1'), part: HEAD }, [
  { name: 'As it is' },
  { name: 'Pointer on Done', ...tipped(DONE) },
  { name: 'Keys: Tab on Done', focus: DONE },
  { name: 'Done pressed', hover: DONE, steps: [{ press: DONE }] },
  { name: 'Done sent, waiting for Taska', steps: [{ click: DONE }], net: { '^/p/shop/api/op': 'hang' } },
  { name: 'Pointer on All actions (\u22ef)', ...tipped('#itemMenuBtn') },
  { name: 'Pointer on the next item', ...tipped('#dNav button:nth-child(2)') },
  { name: 'Pointer on the status', ...tipped('#detailBody [data-arm="s"]') },
  { name: 'Keys: Tab on the priority', focus: '#detailBody [data-arm="p"]' },
  { name: 'Pointer on Now (to Later)', ...tipped('#detailView [data-f="when"][title]:not(#dActs *)') },
  { name: 'Its subitems', part: SUBS },
  { name: 'Pointer on a subitem', part: SUBS, hover: SUB },
  { name: 'A subitem pressed', part: SUBS, steps: [{ press: SUB }] },
  { name: 'Pointer on Add (a subitem)', part: [SUBS, '#tip'], hover: `${SUBS} [data-act="sub-new"]` },
])
/** The line between the item and its talk, dragged: it stays blue while you drag. */
export const LineDragged = desk(at('T3', [{ press: '[data-grip="top"]' }], { live: false }))
