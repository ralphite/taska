// What you sent that Taska does not have yet: each input on its way, with its files, and how the lists say it.

import type { FileRef } from './types'

export interface OutFile extends FileRef {
  /** still being uploaded */
  uploading?: boolean
  failed?: boolean
  /** a picture's look before it is up (this page only) */
  preview?: string
  /** the page's own id for it while it goes up */
  key?: string
  /** kept in this browser (with its audio) under this id until Taska has it */
  rid?: string
}

export interface Outgoing {
  /** the page's id for it: the server takes it once */
  q: string
  slug: string
  text: string
  /** the item it replies on (its code), or null for a new input */
  scope: string | null
  kind?: 'answer'
  files: OutFile[]
  t: number
  state: 'waiting' | 'sending' | 'failed'
  /** failed because the server was away (it goes again by itself) */
  net?: boolean
  tries: number
  /** sent before a reload, going out again now */
  back?: boolean
  /** its toast says nothing (an answer, a note with a decision) */
  quiet?: boolean
  /** taken back while on its way: deleted once the server has it */
  unsent?: boolean
}

/** The first line of what you sent, as the lists show it while it is on its way. */
export const outgoingLine = (o: Pick<Outgoing, 'text' | 'files'>) =>
  o.text.split('\n')[0] ||
  (o.files.some((f) => (f.mime || '').startsWith('audio/')) ? 'Voice note' : `${o.files.length} file${o.files.length === 1 ? '' : 's'}`)

/** Where it is, in a few words: on its way, waiting for Taska (away), uploading its files, or not sent. */
export const outgoingState = (o: Outgoing, away: number) =>
  o.state === 'failed' && !o.net ? 'Not sent' : o.state === 'failed' || away >= 2 ? 'Waiting for Taska…' : o.files.some((f) => f.uploading) ? 'Uploading…' : 'Sending…'
