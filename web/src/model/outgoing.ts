// What you sent that Taska does not have yet: each input on its way, with its files, and how the lists say it.

import type { FileRef, Voice } from './types'
import { voiceLacks, voiceWords } from './voices'

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
  /** a voice note's words as Taska gave them while you wrote (the box's working copy; once sent, the note's record) */
  tr?: string
}

export interface Outgoing {
  /** the page's id for it: the server takes it once */
  q: string
  slug: string
  text: string
  /** the item it replies on (its code), or null for a new input */
  scope: string | null
  /** cancelled: a recording cancelled with Esc, kept in the inputs without being sent (B627) */
  kind?: 'answer' | 'cancelled'
  files: OutFile[]
  /** each voice note's words as they were in the box when you sent it, by file (B682): what was typed is `text` */
  words?: Record<string, string>
  t: number
  state: 'waiting' | 'sending' | 'failed'
  /** failed because the server was away (it goes again by itself) */
  net?: boolean
  tries: number
  /** sent before a reload, going out again now */
  back?: boolean
  /** its toast says nothing (an answer, a note with a decision) */
  quiet?: boolean
  /** cancelled while on its way (its ×): deleted once the server has it */
  unsent?: boolean
}

/** Whether it shows as on its way: one sent before a reload whose file goes up again shows once it is up, as the page
 * always has (it is sent all the same). */
export const showsOnItsWay = (o: Pick<Outgoing, 'back' | 'files'>) => !(o.back && o.files.some((f) => f.uploading))

/** A voice note on its way, its words: those it had in the box, else its record's (`voices`), else the words Taska
 * gave for it; '' while there are none. */
export const outgoingWords = (o: Pick<Outgoing, 'files'> & Pick<Partial<Outgoing>, 'words'>, f: OutFile, voices?: ReadonlyMap<string, Voice>) =>
  (f.f && o.words?.[f.f]) || voiceWords(f.f ? voices?.get(f.f) : undefined) || f.tr || ''

/** What you sent, as it reads while it is on its way: what was typed, then each voice note's words. */
export const outgoingText = (o: Pick<Outgoing, 'text' | 'files'> & Pick<Partial<Outgoing>, 'words'>, voices?: ReadonlyMap<string, Voice>) =>
  [o.text.trim(), ...o.files.filter((f) => (f.mime || '').startsWith('audio/')).map((f) => outgoingWords(o, f, voices))].filter(Boolean).join('\n')

/** The first line of what you sent, as the lists show it while it is on its way: its words (a voice note's too); a
 * note whose words are still to come says so. */
export const outgoingLine = (o: Pick<Outgoing, 'text' | 'files'> & Pick<Partial<Outgoing>, 'kind' | 'words'>, voices?: ReadonlyMap<string, Voice>) => {
  const note = o.files.find((f) => (f.mime || '').startsWith('audio/'))
  return (
    outgoingText(o, voices).split('\n')[0] ||
    (o.kind === 'cancelled' ? 'Cancelled voice note' : '') ||
    (note ? voiceLacks(note.f ? voices?.get(note.f) : undefined) : `${o.files.length} file${o.files.length === 1 ? '' : 's'}`)
  )
}

/** Taska is out of reach (its connection lost, or no answer for a while): it waits to be sent. */
export const outgoingWaits = (o: Pick<Outgoing, 'state' | 'net'>, away: number) => (o.state === 'failed' ? !!o.net : away >= 2)

/** Where it is, in a few words: on its way, waiting for Taska (away), uploading its files, or not sent. */
export const outgoingState = (o: Outgoing, away: number) =>
  o.state === 'failed' && !o.net ? 'Not sent' : outgoingWaits(o, away) ? 'Waiting for Taska…' : o.files.some((f) => f.uploading) ? 'Uploading…' : 'Sending…'
