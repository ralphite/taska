// Words and looks shared by every part of the page. Colors carry one meaning each: amber = needs you, blue = in
// progress, red = P0 / errors, green = done, faded = closed.
import type { IconName } from './icons'
import type { ItemType, Pri, Status, When } from './types'

export const LETTER: Record<ItemType, string> = { feature: 'F', bug: 'B', idea: 'I', task: 'T', rule: 'R' }
export const TYPES: ItemType[] = ['feature', 'bug', 'idea', 'task']
export const TYPE_OF_LETTER: Record<string, ItemType> = Object.fromEntries(
  Object.entries(LETTER).map(([t, l]) => [l.toLowerCase(), t as ItemType]),
)
export const TYPE_TEXT: Record<ItemType, string> = {
  feature: 'text-blue-700 dark:text-blue-300',
  bug: 'text-red-700 dark:text-red-300',
  idea: 'text-violet-700 dark:text-violet-300',
  task: 'text-teal-700 dark:text-teal-300',
  rule: 'text-zinc-700 dark:text-zinc-300',
}
export const RULE_STATUS: Partial<Record<Status, string>> = { proposed: 'Proposed', open: 'Active', dropped: 'Retired' }
export const PRI_TEXT: Record<Pri, string> = {
  P0: 'font-semibold text-red-600 dark:text-red-400',
  P1: 'font-semibold text-zinc-700 dark:text-zinc-200',
  P2: 'text-zinc-500 dark:text-zinc-400',
  P3: 'text-zinc-400 dark:text-zinc-500',
}
export const STATUS: Record<Status, string> = {
  proposed: 'Proposed',
  open: 'Open',
  doing: 'In progress',
  review: 'In review',
  done: 'Done',
  dropped: "Won't do",
}
export const WHEN: Record<When, string> = { now: 'Now', later: 'Later' }
export const KIND: Record<string, string> = {
  ask: 'Question',
  block: 'Blocked',
  withdraw: 'Withdrawn',
  propose: 'Proposal',
  decide: 'Decision',
} // T359: no tag on progress, which most messages are: a tag says something only where it differs
export const AGENT_NAME: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  antigravity: 'Antigravity',
  agent: 'Agent',
}
// an agent's mark: one letter of its own (T529: Antigravity's is V, as A is any agent's and G an unknown Gemini's)
export const AVATAR: Record<string, string> = { 'claude-code': 'C', codex: 'X', antigravity: 'V', org: 'O', agent: 'A' }
export const QUIET_MS = 30 * 60 * 1000 // the server's CLAIM_TTL: quiet longer than this, another agent may take the item (F194)

// Buttons and fields
export const HIT = 'relative after:absolute after:inset-x-0 after:-inset-y-1.5' // a 32px control gets a 44px touch area
export const BTN =
  'rounded-lg px-2.5 py-2.5 sm:py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
export const LINK_BTN = `${HIT} flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10`
export const PRIMARY_BASE =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-transparent px-4 text-[15px] font-semibold' // T438 #3: the same box as SECOND, so a decided card's buttons keep their size
export const PRIMARY =
  PRIMARY_BASE + ' bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
export const SECOND =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-[15px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
// F428: a button of a card you already answered, kept where it was: the one you chose ticked, the other quieter.
// T438 #3: no weight of its own: it keeps the weight of the button it was (font-medium or font-semibold), so its size too
const DONE_BASE =
  'pointer-events-none inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-4 text-[15px]'
export const DONE_PICK =
  DONE_BASE + ' border-transparent bg-zinc-200 text-zinc-700 dark:bg-zinc-700/70 dark:text-zinc-200'
export const DONE_OTHER = DONE_BASE + ' border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500'
// B485: what you did not choose, still a button: quiet like the other, and itself again under the pointer
export const DONE_OTHER_BTN =
  'inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-200 px-4 text-[15px] font-medium text-zinc-400 hover:border-zinc-300 hover:bg-white hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-500 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
export const MODIFY_LINK =
  '-my-2 h-9 shrink-0 rounded-lg px-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 lg:opacity-0 lg:group-hover/form:opacity-100 lg:focus-visible:opacity-100 dark:text-blue-400 dark:hover:bg-blue-400/10'
export const CHIP = `${HIT} flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 text-[13px] hover:bg-zinc-200/70 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80`
export const NEEDS_CARD = 'rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-400/7'
export const FIELD =
  'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950'
export const DC_BTN =
  'relative after:absolute after:inset-x-0 after:-inset-y-2.5 flex h-6 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-zinc-500 hover:bg-blue-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-blue-400/10 dark:hover:text-zinc-200' // B305: 24px tall, 44px to tap
export const SMALL_BTN =
  'flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
export const P_BTN =
  'relative after:absolute after:inset-x-0 after:-inset-y-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
export const REF_CLS = 'cursor-pointer font-medium text-blue-600 hover:underline dark:text-blue-400'

export const MSG = (by: string) =>
  by === 'you'
    ? 'ml-8 rounded-xl bg-blue-100/80 px-3 py-2 dark:bg-blue-900/40'
    : 'mr-8 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800'
export const WHO = (by: string) =>
  by === 'you' ? 'font-medium text-blue-700 dark:text-blue-300' : 'font-medium text-zinc-700 dark:text-zinc-300'

// Every project has its own colour (B78): from the name, the next free one when two would share
export const PROJ_TONES = [
  'bg-violet-600 dark:bg-violet-500',
  'bg-teal-600 dark:bg-teal-500',
  'bg-pink-600 dark:bg-pink-500',
  'bg-blue-600 dark:bg-blue-500',
  'bg-slate-600 dark:bg-slate-500',
  'bg-fuchsia-600 dark:bg-fuchsia-500',
  'bg-cyan-600 dark:bg-cyan-500',
  'bg-indigo-600 dark:bg-indigo-500',
]

// Each kind of "needs you" has its own color and icon (B96): Accept green, Approve blue, Answer amber, Reply red.
export const NEED = {
  accept: {
    icon: 'check',
    pill: 'bg-emerald-100 text-emerald-900 ring-emerald-300/80 dark:bg-emerald-400/15 dark:text-emerald-100 dark:ring-emerald-400/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    btn: 'bg-emerald-600 text-white hover:brightness-95 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:brightness-110',
  },
  approve: {
    icon: 'thumb',
    pill: 'bg-blue-100 text-blue-900 ring-blue-300/80 dark:bg-blue-400/15 dark:text-blue-100 dark:ring-blue-400/30',
    text: 'text-blue-700 dark:text-blue-400',
    btn: 'bg-blue-600 text-white hover:brightness-95 dark:bg-blue-500 dark:text-blue-950 dark:hover:brightness-110',
  },
  answer: {
    icon: 'ask',
    pill: 'bg-amber-100 text-amber-950 ring-amber-300/80 dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-400/30',
    text: 'text-amber-700 dark:text-amber-400',
    btn: 'bg-amber-500 text-amber-950 hover:brightness-95 dark:bg-amber-400 dark:text-amber-950 dark:hover:brightness-110',
  },
  reply: {
    icon: 'reply',
    pill: 'bg-rose-100 text-rose-900 ring-rose-300/80 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30',
    text: 'text-rose-700 dark:text-rose-400',
    btn: 'bg-rose-600 text-white hover:brightness-95 dark:bg-rose-500 dark:text-rose-950 dark:hover:brightness-110',
  },
} as const
export type NeedKind = keyof typeof NEED
export const ACTION_PILL = (v: NeedKind) =>
  `inline-flex h-8 w-24 items-center justify-center gap-1 rounded-full pr-3 pl-2.5 text-[13px] font-semibold ring-1 ring-inset ${NEED[v].pill}` // T438 #3: one width, so the row's other buttons sit at the same place on every row

export const ACT_KEY: Record<string, string> = {
  Done: 'D',
  Accept: 'A',
  Approve: 'A',
  Archive: 'E',
  Unarchive: 'E',
  Later: 'L',
  'Back to now': 'L',
  "Won't do": 'W',
  'Not yet': 'N',
  Start: 'S then 3',
  Pause: 'S then 2',
  'Back to queue': 'S then 2',
  Reopen: 'S then 2',
  Retire: 'W',
  Reactivate: 'D',
}
export const ACT_TONE: Record<string, string> = {
  Done: 'text-emerald-600 dark:text-emerald-400',
  Accept: 'text-emerald-600 dark:text-emerald-400',
  Approve: 'text-blue-600 dark:text-blue-400',
  Archive: 'text-emerald-600 dark:text-emerald-400',
  Start: 'text-blue-600 dark:text-blue-400',
  "Won't do": 'text-red-600 dark:text-red-400',
  Retire: 'text-red-600 dark:text-red-400',
  Reactivate: 'text-blue-600 dark:text-blue-400',
}
export const ACT_ICON: Record<string, IconName> = {
  Approve: 'thumb',
  Accept: 'check',
  Done: 'done',
  Archive: 'archive',
  Later: 'clock',
  'Back to now': 'clock',
  "Won't do": 'ban',
  'Not yet': 'reopen',
  Pause: 'pause',
  Start: 'start',
  'Back to queue': 'reopen',
  Reopen: 'reopen',
  Unarchive: 'unarchive',
  Answer: 'ask',
  Reply: 'reply',
  Retire: 'ban',
  Reactivate: 'reopen',
}
export const ACT_BG: Record<string, string> = {
  Start: 'bg-blue-600 dark:bg-blue-500',
  "Won't do": 'bg-red-600 dark:bg-red-500',
  Done: 'bg-emerald-600 dark:bg-emerald-500',
}
export const FOCUS_TONE: Record<string, string> = {
  Start: 'text-blue-600 dark:text-blue-400',
  "Won't do": 'text-red-600 dark:text-red-400',
  Done: 'text-emerald-700 dark:text-emerald-400',
  Archive: 'text-emerald-700 dark:text-emerald-400',
  Unarchive: 'text-emerald-700 dark:text-emerald-400',
}
export const FWD_NEED: Record<string, NeedKind> = {
  Accept: 'accept',
  Approve: 'approve',
  Answer: 'answer',
  Reply: 'reply',
}
export const STATE_ON: Record<Status, string> = {
  proposed: 'text-amber-400 dark:text-amber-600',
  review: 'text-amber-400 dark:text-amber-600',
  doing: 'text-blue-400 dark:text-blue-600',
  done: 'text-emerald-400 dark:text-emerald-600',
  open: 'text-zinc-400 dark:text-zinc-500',
  dropped: 'text-zinc-400 dark:text-zinc-500',
}
export const STAT_BTN =
  'group flex min-w-0 items-center gap-1.5 bg-zinc-100 text-[13px] font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900'
export const SEG_ON =
  'aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-zinc-900/5 dark:aria-pressed:bg-zinc-600 dark:aria-pressed:text-white dark:aria-pressed:ring-white/10'

// T274 #6: five places an item can be: it needs you, an agent is on it, it waits in the queue, later, finished
export const STATUS_FILTER: Record<string, string> = {
  wait: 'Needs you',
  doing: 'In progress',
  queued: 'Queued',
  later: 'Later',
  closed: 'Finished',
}
export const SORTS: [string, string][] = [
  ['all', 'Priority'],
  ['new', 'Newest'],
  ['upd', 'Last updated'],
]
export const ARCH_FILTER: Record<string, string> = { done: 'Done', dropped: "Won't do", active: 'Not finished' }
export const TAB_NAME: Record<string, string> = { items: 'Items', inputs: 'Inputs', archive: 'Archive', rules: 'Rules' }
export const TABS = ['items', 'inputs', 'archive', 'rules'] as const
export type Tab = (typeof TABS)[number]
export const VIEW_KEYS = ['q', 'type', 'when', 'status', 'pri', 'sort'] as const
export const NEEDS_SHOWN = 5
export const SAID: Record<string, string> = {
  open: 'is open',
  doing: 'is in progress',
  done: 'is done',
  dropped: "is marked won't do",
  later: 'moved to Later',
  now: 'is back to now',
  review: 'is in review',
  proposed: 'is proposed',
}
