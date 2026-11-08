// What the server sends: a project's view (GET /p/<project>/api/view) and the workspace's answers. The shapes are
// the server's page_api/views.py.

export type ItemType = 'feature' | 'bug' | 'idea' | 'task'
export type Status = 'proposed' | 'open' | 'doing' | 'review' | 'done' | 'dropped'
export type Pri = 'P0' | 'P1' | 'P2' | 'P3'
export type When = 'now' | 'later'
export type Kind = 'say' | 'ask' | 'withdraw' | 'propose' | 'decide' | 'progress'

export interface FileRef {
  f: string
  name: string
  mime?: string
  size?: number
  /** a voice note's words: its one record (B682), put here by the page's model from the project's voices (never
   * sent or kept with the file) */
  voice?: Voice
}

/** A voice note's words (B682): the one record every place that shows the note reads. `said`: word for word;
 * `tidied`: what everyone reads (yours once you changed them: `fixed`, when); `early`: the first words while it is
 * worked out (state wait); none: nobody was heard; failed: `err` says why. */
export interface Voice {
  f: string
  state: 'wait' | 'done' | 'none' | 'failed'
  said: string
  tidied: string
  early?: string
  err?: string
  fixed?: string
}

export interface Message {
  id: number
  by: string
  kind: Kind
  /** what was said: the words typed, then the words of the voice notes of the input it is (the page's model) */
  text: string
  /** the words typed alone, as Taska keeps them */
  typed?: string
  t: string
  src: string | null
  files: FileRef[]
  ses?: string
  to?: string[]
  edited?: string
  change?: boolean
  hidden?: boolean
}

export interface Wait {
  id: number
  kind: 'ask'
  text: string
  by: string
  ses?: string | null
  files: FileRef[]
}

export interface Item {
  n: number
  code: string
  type: ItemType
  title: string
  body: string
  pri: Pri
  when: When
  status: Status
  parent: number | null
  next: string
  srcs: string[]
  mergedInto: number | null
  archived: boolean
  t0: string
  t1: string
  by: string | null
  thread: Message[]
  wait: Wait | null
  /** the user spoke last on it (a comment on one of its documents counts) */
  talked: boolean
  agent?: { by: string; t: string; ses?: string | null }
  rank?: number | null
  /** Later until this day (YYYY-MM-DD, local): then back to Now by itself (D115 #21) */
  later_until?: string | null
  decided?: { from: string; to: string; msg: number | null; t: string } | null
  readBy?: Record<string, number>
}

export interface OrgNote {
  ok: boolean
  msg: string
  t: string
  keep: boolean
  changed: boolean
  undone: boolean
}

export interface Input {
  id: string
  t: string
  by: string
  /** what was said: the words typed, then each voice note's words (the page's model puts them together) */
  text: string
  /** the words typed alone, as Taska keeps them */
  typed?: string
  scope: number | null
  files: FileRef[]
  acked: boolean
  touched: number[]
  org: OrgNote | null
  seq: number
  v: number
  /** answer: a form sent on its item; cancelled: a recording cancelled with Esc, kept, not sent (B627) */
  kind?: 'answer' | 'cancelled'
  /** the page's own id for it, as it was sent (its outbox entry's): one still on its way that Taska has shows once */
  q?: string
  history?: { text: string; t: string; mode: string }[]
  updated?: string
  moved?: { to: string; as: string }
  filing?: { can: boolean; what: string; why: string }
  deletion?: { go: number[]; keep: [number, string][] }
}

export interface Comment {
  id: number
  key: string
  th: number
  quote: string
  /** what was said: the words typed, then each voice note's words (the page's model puts them together) */
  text: string
  /** the words typed alone, as Taska keeps them */
  typed?: string
  by: string
  t: string
  files: FileRef[]
  edited?: string
}

export interface Block {
  key: string
  kind: 'heading' | 'para' | 'list' | 'quote' | 'code' | 'table' | 'html'
  text: string
  comments: Comment[]
}

export interface Doc {
  d: number
  n: number
  title: string
  md: string
  t0: string
  t1: string
  by: string
  versions: number
  fmt: 'md' | 'html'
  blocks: Block[]
  detached: { key: string; quote: string; comments: Comment[] }[]
  whole: Comment[]
  unanswered: number
  resolved: Record<string, string>
  /** the project's rules (I693): one document of the project, not of an item (n 0) */
  kind?: 'rules'
  proposals?: RuleProposal[]
  history?: RuleVersion[]
}

/** A version of the rules (I693): who, when (its first and last save), every why (newest first), the inputs it came
 * from, the text it left; a restore says which version it put back; an approved proposal, which one. */
export interface RuleVersion {
  v: number
  by: string
  t0: string
  t: string
  md: string
  whys: string[]
  srcs: string[]
  /** its last save's number in the log (Undo takes it back) */
  seq: number
  restored?: number
  p?: number
  ses?: string
}

/** An agent's proposed change to the rules: waiting (with the text it would make now), approved, declined, or sent
 * back to its agent because a section it changes changed since (note). Its talk is its thread. */
export interface RuleProposal {
  id: number
  by: string
  ses?: string
  t: string
  why: string
  state: 'wait' | 'approved' | 'declined' | 'stale'
  /** the version it was written on */
  on: number
  md?: string
  note?: string
  decided?: string
  src?: string
  comments: Comment[]
}

export interface AgentSeen {
  name: string
  t: number
  waiting: boolean
  session?: string
  sessions?: { name: string; t: number }[]
  /** its sessions that wait on the user now (T711): the session's title, what it waits on, since when */
  blocked?: { session: string; waitingFor: string; since: number }[]
}

/** A place where a voice note may be misheard: its words, what the other model heard there, why; the same two
 * words elsewhere (also); which side you picked. */
export interface Doubt {
  was: string
  alt: string
  why: string
  unsure?: boolean
  show?: [string, string]
  also?: { was: string; alt: string }[]
  pick?: 'was' | 'alt'
}

/** What the server says of a voice note's words. */
export interface WordsAnswer {
  f: string
  done: boolean
  tr: string
  tr_error: string
  doubts?: Doubt[]
  more?: boolean
  heard?: string
  /** every step that worked out its words (T697) */
  steps?: VoiceStep[]
}

/** One step of working out a voice note's words (T697): which one (pro: the strong model, asr: the speech model,
 * pro_loud / asr_loud: theirs once more, louder, pieces: piece by piece, tidy), its model, its words or its error,
 * how long it took (s), and whether its words were chosen. */
export interface VoiceStep {
  step: string
  model: string
  text?: string
  error?: string
  secs?: number
  chosen?: boolean
}

/** A voice spelling: words heard wrong and the right ones, or a word to hear (no `wrong`). */
export interface Spelling {
  wrong?: string
  right: string
  t?: string
}

/** How voice notes are written down (`default`: the text Taska came with). */
export interface VoicePrefs {
  text: string
  default: boolean
  tidy?: boolean
}

/** One change of the project's log, as the server lists it. */
export interface LogRow {
  seq: number
  t: string
  who: string
  what: string
  ses?: string
}

export interface UndoEntry {
  seq: number
  n: number
  f: Record<string, unknown>
  was: Record<string, unknown>
  t: string
}

export interface DeletedInput {
  id: string
  t: string
  at: string
  text: string
  files: number
  scope: number | null
  items: { n: number; code: string; title: string; type: ItemType }[]
  kept: { n: number; code: string; title: string; type: ItemType; why: string }[]
}

export interface DeletedThing {
  kind: 'item' | 'doc'
  n?: number
  code?: string
  d?: number
  title: string
  at: string
  more?: number
  on?: string
}

export interface ProjectFacts {
  slug: string
  title: string
  width: number
  file: string
  /** busy: the inputs the organizer works on now (several at once) */
  organizer: { on: boolean; model: string; busy: readonly string[] }
  agents: AgentSeen[]
  work: boolean
  agentsVersion: number
  undo: UndoEntry[]
  deletedInputs: DeletedInput[]
  deleted: DeletedThing[]
  base: string
  key: string
  remote: string
  /** this project on Taska's own network ("http://192.168.1.20:7340/p/x"): a phone there needs no key; '' when Taska
   * listens on this machine only */
  lan: string
  /** Taska was opened on a phone, or a phone gets its pushes (D115 #20) */
  phone?: boolean
}

export interface ServerFacts {
  page: string
  update: boolean
}

/** GET view / changes: all of a project (full) or what changed since the cursor. */
export interface ViewAnswer {
  cursor: string
  full: boolean
  same?: boolean
  items: Item[]
  inputs: Input[]
  docs: Doc[]
  /** every voice note's words (B682) */
  voices?: Voice[]
  removed?: { items: number[]; inputs: string[]; docs: number[]; voices?: string[] }
  project: ProjectFacts
  server: ServerFacts
}

/** GET /api/projects: one row per project. */
export interface ProjectRow {
  name: string
  title: string
  open: number
  needs: number
  /** done or dropped on Items (F667: a list kept from before may not have these) */
  closed?: number
  inputs?: number
  docs?: number
  agents?: AgentSeen[]
  work?: boolean
  t?: number
  pos?: number
}

export interface Need {
  project: string
  ptitle: string
  n: number
  code: string
  title: string
  kind: string
  pri: Pri
  t: string
}

export interface SearchHit {
  project: string
  ptitle: string
  kind: 'item' | 'input'
  code: string
  title: string
  status?: Status
  archived?: boolean
  t: string
}

/** One of your views of the item list: the filters it sets, with a name (the same in every project). */
export interface SavedView {
  name: string
  type: string
  when: string
  status: string
  pri: string
  sort: string
}
