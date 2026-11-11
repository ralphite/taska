// What you sent that Taska does not have yet: each input on its way, with its files, and its words as the lists show
// them (where it is on its way, and what can be done: model/outgoingStates).

import type { FileRef, Input, Message, Voice } from './types'
import { voiceWords } from './voices'
import { voiceLacks } from './voiceStates'
import { filesLine, type UpFields } from './fileStates'
import { outgoingIn, type OutPlace, type OutShow } from './outgoingStates'

/** A file on its way: its upload state (`f`, `uploading`, `failed`) is model/fileStates `fileState`. */
export interface OutFile extends FileRef, UpFields {
  f: string
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
  /** an answer to some of the questions in a row: theirs (B749); the others keep waiting */
  of?: number[]
  files: OutFile[]
  /** each voice note's words as they were in the box when you sent it, by file (B682): what was typed is `text` */
  words?: Record<string, string>
  t: number
  /** waiting: to go out (in order); sending: going out now; failed: not answered (`net`) or refused. Its phase, as
   * every place shows it, is model/outgoingStates `outPhase` */
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

/** What you sent that a talk has already, by the page's own id for it: Taska's news of it can come before its answer
 * to the send, and then it shows there, not a second time on its way (B719 r1178: shown twice a moment, then one went
 * and the talk jumped). */
export const inTalk = (thread: readonly Pick<Message, 'by' | 'src'>[], inputs: ReadonlyMap<string, Pick<Input, 'q'>>): ReadonlySet<string> =>
  new Set(
    thread.flatMap((x) => {
      const q = x.by === 'you' && x.src ? inputs.get(x.src)?.q : undefined
      return q ? [q] : []
    }),
  )

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
    (note ? voiceLacks(note.f ? voices?.get(note.f) : undefined) : filesLine(o.files))
  )
}

/** Something on its way as a list draws it: its words on one line, where it is and what can be done
 * (model/outgoingStates), the item it goes to, its pictures as they were picked. */
export interface OutgoingFacts {
  q: string
  text: string
  show: OutShow
  scope: string | null
  previews: string[]
}

/** `o` as `place` lists it (`away`: how sure the page is that Taska is out of reach); null: it does not show there. */
export function outgoingFacts(o: Outgoing, away: number, place: OutPlace): OutgoingFacts | null {
  const show = outgoingIn(o, away, place)
  return show ? { q: o.q, text: outgoingText(o) || outgoingLine(o), show, scope: o.scope, previews: o.files.flatMap((f) => (f.preview ? [f.preview] : [])) } : null
}
