// What the server sends: a project's view (GET /p/<project>/api/view) and the workspace's answers. The shapes are
// the server's page_api/views.py.

export type ItemType = 'feature' | 'bug' | 'idea' | 'task' | 'rule'
export type Status = 'proposed' | 'open' | 'doing' | 'review' | 'done' | 'dropped'
export type Pri = 'P0' | 'P1' | 'P2' | 'P3'
export type When = 'now' | 'later'
export type Kind = 'say' | 'ask' | 'block' | 'withdraw' | 'propose' | 'decide' | 'progress'

export interface FileRef {
  f: string
  name: string
  mime?: string
  size?: number
  tr?: string
  wait?: boolean
}

export interface Message {
  id: number
  by: string
  kind: Kind
  text: string
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
  kind: 'ask' | 'block'
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
  text: string
  scope: number | null
  files: FileRef[]
  acked: boolean
  touched: number[]
  org: OrgNote | null
  seq: number
  v: number
  kind?: 'answer'
  history?: { text: string; t: string; mode: string }[]
  updated?: string
  moved?: { to: string; as: string }
  trWait?: boolean
  filing?: { can: boolean; what: string; why: string }
  deletion?: { go: number[]; keep: [number, string][] }
}

export interface Comment {
  id: number
  key: string
  th: number
  quote: string
  text: string
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
}

export interface AgentSeen {
  name: string
  t: number
  waiting: boolean
  session?: string
  sessions?: { name: string; t: number }[]
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
  organizer: { on: boolean; model: string; busy: string | null }
  agents: AgentSeen[]
  work: boolean
  agentsVersion: number
  undo: UndoEntry[]
  deletedInputs: DeletedInput[]
  deleted: DeletedThing[]
  base: string
  key: string
  remote: string
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
  removed?: { items: number[]; inputs: string[]; docs: number[] }
  project: ProjectFacts
  server: ServerFacts
}

/** GET /api/projects: one row per project. */
export interface ProjectRow {
  name: string
  title: string
  open: number
  needs: number
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
