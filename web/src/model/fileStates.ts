// A file's upload state, in one place (T728 #10): a picture, a file or a voice note you added is going up, up (Taska
// has it: it has its `f`), or failed (Taska refused it: it is not up and does not go). Every place that asks whether
// a file is up, still going up or failed reads it here: what goes out with a message, an edit or a comment, what a
// reload keeps, what the box's files look like, what a message on its way says when it has no words. A voice note's
// own states (its words) build on this one (model/voiceStates `noteState`). Pure.

/** What is kept of a file while it goes up (the box's draft files, the outbox's). */
export interface UpFields {
  /** Taska's name for it once it is up ('' until then) */
  f?: string
  /** going up to Taska */
  uploading?: boolean
  /** Taska refused it (B725): it is not up */
  failed?: boolean
}

/** busy: blue, moving, faded; failed: red */
export type FileTone = 'busy' | 'failed' | null

interface StateDef {
  label: string
  /** its words where a file's words are said ('' : none, it is just there) */
  say: string
  tone: FileTone
}

export const FILE_STATES = {
  uploading: { label: 'Going up', say: 'Uploading…', tone: 'busy' },
  up: { label: 'Up', say: '', tone: null },
  // the words a voice note says too (model/voiceStates `uploadFailed`)
  failed: { label: 'Upload failed', say: 'Upload failed', tone: 'failed' },
} as const satisfies Record<string, StateDef>

export type FileState = keyof typeof FILE_STATES
export const FILE_STATE_LIST = Object.keys(FILE_STATES) as FileState[]

/** A file's upload state, from what is kept of it: the one place it is worked out. Refused wins; without Taska's name
 * for it yet it is still going up. */
export function fileState(f: UpFields): FileState {
  if (f.failed) return 'failed'
  if (f.uploading || f.f === '') return 'uploading'
  return 'up'
}

/** Up: it goes with what it was added to. */
export const isUp = (f: UpFields) => fileState(f) === 'up' && !!f.f

/** Still going up: what it was added to waits for it. */
export const goingUp = (f: UpFields) => fileState(f) === 'uploading'

/** Not refused: a reload keeps it (going up, or up and not sent yet). */
export const notFailed = (f: UpFields) => fileState(f) !== 'failed'

/** A message's files said in a few words when it has no words of its own (on its way): how many go, or that none
 * could go up. */
export function filesLine(files: readonly UpFields[]): string {
  const going = files.filter(notFailed).length
  if (!going && files.length) return FILE_STATES.failed.say
  return `${going} file${going === 1 ? '' : 's'}`
}
