// A change the page asks for: the commands agents write, as data ({op: 'set', ref: 'B03', f: {...}}). One member per
// command the server handles (server/taska/commands/, `@handles`), with the fields its handler reads, so a sender
// that names a field the server never reads, or an op it has no handler for, does not compile.
// api/samples.gen.ts lists what each server handler reads (tools/api_samples.py writes it); api/commands.test.ts holds
// this list to that one.

import type { ItemType, Kind, Pri, Status, When } from './types'

/** A file a command brings along, uploaded first (POST /api/file): Taska's name for it, and what the page knows. */
export interface SentFile {
  f: string
  name?: string
  mime?: string
  size?: number
}

/** A voice note's words as you left them, by its file: they become the note's words (B682). */
export type SentWords = Record<string, string>

/** The fields `set` changes, as the server takes them (commands/items.py field_value): a parent by its code, or
 * 'none'; a day as YYYY-MM-DD, or null for none; a rank, or null for the usual order. */
export interface SetFields {
  type?: ItemType
  pri?: Pri
  when?: When
  status?: Status
  title?: string
  body?: string
  next?: string
  archived?: boolean
  later_until?: string | null
  rank?: number | null
  parent?: string
}

/** One change to the rules by its sections (I693): replace a section, add one (after a section), or remove one. */
export interface SectionEdit {
  op: string
  section?: string
  md?: string
  after?: string
}

/** A tick of a choice in a document: the list's block (its key and which of the same), its text with the ticks. */
export interface Tick {
  key: string
  occ?: number
  text: string
}

/** Every command takes the input it came from (`src`; commands/run.py reads it for each one). */
interface From {
  src?: string
}

export type Command = From &
  (
    // items (commands/items.py)
    | { op: 'new'; title: string; type?: ItemType; pri?: Pri; when?: When; status?: Status; body?: string; next?: string; parent?: string }
    | { op: 'set'; ref: string; f: SetFields; undo_of?: number }
    | { op: 'say'; ref: string; text: string; kind?: Kind; files?: (SentFile | string)[] }
    | { op: 'merge'; ref: string; into: string }
    | { op: 'unmerge'; ref: string }
    | { op: 'archive'; refs: string[]; on?: boolean }
    | { op: 'idel' | 'iundel'; ref: string }
    | { op: 'hide'; ref: string; id: number; on?: boolean }
    | { op: 'due'; ref: string; today: string }
    // what you said (commands/inputs.py)
    | { op: 'input'; text?: string; files?: SentFile[]; scope?: string | null;kind?: 'answer' | 'cancelled'; q?: string; words?: SentWords }
    | { op: 'send' | 'delete' | 'restore'; id: string }
    | { op: 'correct'; id: string; wrong: string; right: string; v?: number }
    | { op: 'amend'; id: string; mode: 'edit' | 'append'; v?: number; text?: string; files?: SentFile[]; words?: SentWords }
    | { op: 'ack'; ids: string[] }
    | { op: 'rescope'; id: string; to: string }
    // documents (commands/docs.py)
    | { op: 'doc'; md: string; d?: number; ref?: string; title?: string; fmt?: 'html' }
    | { op: 'dticks'; d: number; ticks: Tick[] }
    | { op: 'dc'; d: number; key?: string; para?: number | string; pick?: number | string; quote?: string; text?: string; files?: SentFile[]; words?: SentWords; th?: number }
    | { op: 'ddel'; d: number; on?: boolean }
    | { op: 'dmove'; d: number; to: string }
    | { op: 'dcmove'; d: number; id: number; key: string }
    | { op: 'unfile'; f: string; id: string }
    | { op: 'unfile'; f: string; d: number; id: number }
    | { op: 'dcres'; d: number; key: string; on?: boolean; th?: number }
    | { op: 'dcedit'; d: number; id: number; text: string; files?: SentFile[]; words?: SentWords }
    | { op: 'dcdel' | 'dcundel'; d: number; id: number }
    | { op: 'diagram-failed'; d: number; key: string; error: string; v?: number }
    // the rules (commands/rules.py)
    | { op: 'rules'; md: string; why?: string }
    | { op: 'redit' | 'rpropose'; why?: string; edits?: SectionEdit[]; body?: string }
    | { op: 'rdecide'; p: number | string; ok?: boolean }
    | { op: 'rrestore'; v: number }
    | { op: 'rundo'; seq: number }
    | { op: 'rreply'; p: number | string; text: string }
    // what the organizer did, and your earlier changes (commands/filings.py)
    | { op: 'filing-undo' | 'filing-redo' | 'organize-again'; id: string }
    | { op: 'revert'; seq: number }
    // the project (commands/project.py)
    | { op: 'cfg'; name: string }
  )

export type Op = Command['op']

/** Every op, once: the type check fails when one is missing here or is not an op. */
export const OPS = {
  new: true,
  set: true,
  say: true,
  merge: true,
  unmerge: true,
  archive: true,
  idel: true,
  iundel: true,
  hide: true,
  due: true,
  input: true,
  send: true,
  delete: true,
  restore: true,
  correct: true,
  amend: true,
  ack: true,
  rescope: true,
  doc: true,
  dticks: true,
  dc: true,
  ddel: true,
  dmove: true,
  dcmove: true,
  unfile: true,
  dcres: true,
  dcedit: true,
  dcdel: true,
  dcundel: true,
  'diagram-failed': true,
  rules: true,
  redit: true,
  rpropose: true,
  rdecide: true,
  rrestore: true,
  rundo: true,
  rreply: true,
  'filing-undo': true,
  'filing-redo': true,
  'organize-again': true,
  revert: true,
  cfg: true,
} as const satisfies Record<Op, true>

/** One command of the union, by its op (a member for several ops, as this one). */
export type CommandOf<K extends Op> = Command extends infer C ? (C extends { op: infer O } ? (K extends O ? C & { op: K } : never) : never) : never

/** One field of an item as the page holds it -> as `set` sends it: a parent goes as its number's text, or 'none'. */
export function field(f: string, v: unknown): SetFields {
  return { [f]: f === 'parent' ? (v ? String(v) : 'none') : v } as SetFields
}
