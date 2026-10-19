// What the server sends (GET /p/<project>/api/state and the other JSON answers). The shapes follow
// v2/server/taska/views.py (state) and hub.py (projects, needs, search).

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

export interface Msg {
  id: number
  by: string
  kind: Kind
  text: string
  t: string
  src: string | null
  files: FileRef[]
  edited?: string
  change?: boolean
  hidden?: boolean
}

export interface Wait {
  id: number
  kind: 'ask' | 'block'
  text: string
  by: string
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
  thread: Msg[]
  srcs: string[]
  merged_into: number | null
  archived: boolean
  t0: string
  t1: string
  by?: string | null
  agent?: { by: string; t: string }
  rank?: number | null
  wait: Wait | null
  reply: boolean
  read?: Record<string, number>
  deleted?: string | null
}

export interface OrgNote {
  ok: boolean
  msg: string
  t: string
  keep: boolean
  changed?: boolean
  undone?: boolean
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
  from?: string | null
  seq: number
  v?: number
  history?: { text: string; t: string; mode: string }[]
  updated?: string
  moved?: { to: string; as: string }
  deleted?: unknown
  tr_wait?: boolean
  filing?: { can: boolean; what: string; why: string }
  drop?: { go: number[]; keep: [number, string][] }
}

export interface Comment {
  id: number
  key: string
  quote: string
  text: string
  by: string
  t: string
  files?: FileRef[]
  edited?: string
}

export interface Block {
  key: string
  kind: 'heading' | 'para' | 'list' | 'quote' | 'code' | 'table'
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
  t?: string
  by: string
  versions: number
  comments: Comment[]
  blocks: Block[]
  detached: { key: string; quote: string; comments: Comment[] }[]
  whole: Comment[]
  open: number
  resolved?: Record<string, string>
}

export interface Agent {
  name: string
  t: number
  waiting: boolean
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

export interface Gone {
  kind: 'item' | 'doc'
  n?: number
  code?: string
  d?: number
  title: string
  at: string
  more?: number
  on?: string
}

export interface State {
  rev: number
  boot: string
  pv: number
  agents: Agent[]
  work: boolean
  width: number
  file: string
  cfg: { auto: boolean; name?: string }
  undo: UndoEntry[]
  org: { on: boolean; model: string; busy: string | null }
  items: Item[]
  inputs: Input[]
  deleted: DeletedInput[]
  docs: Doc[]
  gone: Gone[]
  project: string
  title: string
  base: string
  key: string
  remote: string
}

export interface ProjectRow {
  name: string
  title: string
  open: number | string
  auto?: boolean
  needs: number
  agents?: Agent[]
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

export interface Transcript {
  f: string
  done: boolean
  tr: string
  tr_error: string
  tr_by?: string
  doubts?: Doubt[]
  more?: boolean
  heard?: string
}

export interface Doubt {
  was: string
  alt: string
  why: string
  unsure?: boolean
  show?: [string, string]
  also?: { was: string; alt: string }[]
  pick?: 'was' | 'alt'
}
