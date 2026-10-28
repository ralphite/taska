// What a draft is written to: a new input, a new rule, a reply on an item, a comment on a document, an edit of
// something you said (or details added to it), a correction in a voice note's words, an edit of one of your comments,
// your transcription rules. The browser keeps drafts under a short key ("new", "F12", "doc 4", "edit r12", ...): that
// key is made and read here only, so everything else works with what it means.

export type DraftTarget =
  | { kind: 'new' }
  | { kind: 'rule' }
  | { kind: 'reply'; code: string }
  | { kind: 'doc'; d: number }
  | { kind: 'amend'; mode: 'edit' | 'append'; id: string }
  | { kind: 'correct'; id: string }
  | { kind: 'comment'; id: number; d: number | null }
  | { kind: 'prefs' }
  /** files on their way with what was sent, out of sight until they are up */
  | { kind: 'held'; id: string }
  /** a key this page does not know (kept as it is) */
  | { kind: 'other'; key: string }

/** A draft's key as the browser keeps it: made only by `draftKey`. */
export type DraftKey = string & { readonly __draft: true }

export function draftKey(t: DraftTarget): DraftKey {
  const k = (() => {
    switch (t.kind) {
      case 'new':
      case 'rule':
      case 'prefs':
        return t.kind
      case 'reply':
        return t.code
      case 'doc':
        return `doc ${t.d}`
      case 'amend':
        return `${t.mode} ${t.id}`
      case 'correct':
        return `correct ${t.id}`
      case 'comment':
        return t.d == null ? `dc ${t.id}` : `dc ${t.d} ${t.id}`
      case 'held':
        return `sending ${t.id}`
      case 'other':
        return t.key
    }
  })()
  return k as DraftKey
}

export function draftTarget(key: string): DraftTarget {
  if (key === 'new' || key === 'rule' || key === 'prefs') return { kind: key }
  if (/^[A-Z]\d+$/.test(key)) return { kind: 'reply', code: key }
  let m = /^doc (\d+)$/.exec(key)
  if (m) return { kind: 'doc', d: Number(m[1]) }
  m = /^(edit|append) (\S+)$/.exec(key)
  if (m) return { kind: 'amend', mode: m[1] as 'edit' | 'append', id: m[2] }
  m = /^correct (\S+)$/.exec(key)
  if (m) return { kind: 'correct', id: m[1] }
  m = /^sending (\S+)$/.exec(key)
  if (m) return { kind: 'held', id: m[1] }
  m = /^dc (?:(\d+) )?(\d+)$/.exec(key)
  if (m) return { kind: 'comment', d: m[1] ? Number(m[1]) : null, id: Number(m[2]) }
  return { kind: 'other', key }
}

/** A key as it came from the browser's store, read and made again. */
export const keyOf = (key: string): DraftKey => draftKey(draftTarget(key))

export const NEW_DRAFT = draftKey({ kind: 'new' })
export const replyDraft = (code: string) => draftKey({ kind: 'reply', code })
export const docDraft = (d: number) => draftKey({ kind: 'doc', d })
export const PREFS_DRAFT = draftKey({ kind: 'prefs' })
/** a reply on the item, or else a new input */
export const scopeDraft = (scope: string | null) => (scope ? replyDraft(scope) : NEW_DRAFT)

const inputNo = (id: string) => id.replace(/^r(\d+)$/, '#$1')

/** A draft's name in what the page says ("a new input", "B12", "the edit of #461"...). */
export function draftName(key: string): string {
  const t = draftTarget(key)
  switch (t.kind) {
    case 'new':
      return 'a new input'
    case 'rule':
      return 'a new rule'
    case 'reply':
      return t.code
    case 'doc':
      return `the comment on D${t.d}`
    case 'amend':
      return `${t.mode === 'edit' ? 'the edit of' : 'the details for'} ${inputNo(t.id)}`
    case 'correct':
      return `the correction in ${inputNo(t.id)}`
    case 'comment':
      return `the edit of comment ${t.id}`
    case 'prefs':
      return 'prefs'
    case 'held':
      return draftKey(t)
    case 'other':
      return t.key
  }
}
