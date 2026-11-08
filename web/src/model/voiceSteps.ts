// How a voice note's words came about, step by step, in the order its words arrived (B727): the first words in full,
// then each later step only as what it changed from the words before it, so no words show twice. Generic over the
// steps the server reports (any model, any retries); only `tidy` (the words agents get) is known to come last.

import type { VoiceStep } from './types'

export type Mark = '' | 'added' | 'removed'
export interface Piece {
  mark: Mark
  text: string
}

/** Words to compare: a CJK character each, a Latin word, a run of spaces or one other sign. */
const CJK = '\\u3400-\\u9fff\\uf900-\\ufaff\\u3000-\\u303f\\uff00-\\uffef'
const TOKEN = new RegExp(`[${CJK}]|(?:(?![${CJK}])[\\p{L}\\p{N}'\\u2019-])+|\\s+|.`, 'gsu')
const tokens = (s: string) => s.match(TOKEN) || []

/** `after` against `before`, word by word (their longest common words kept), joined into runs of one kind. */
export function wordDiff(before: string, after: string): Piece[] {
  const a = tokens(before)
  const b = tokens(after)
  const k = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) k[i][j] = a[i] === b[j] ? k[i + 1][j + 1] + 1 : Math.max(k[i + 1][j], k[i][j + 1])
  const out: Piece[] = []
  const put = (mark: Mark, text: string) => {
    const last = out.at(-1)
    if (last && last.mark === mark) last.text += text
    else out.push({ mark, text })
  }
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      put('', a[i++])
      j++
    } else if (i < a.length && (j >= b.length || k[i + 1][j] >= k[i][j + 1])) put('removed', a[i++])
    else put('added', b[j++])
  }
  return out
}

/** A step as it is shown: its words in full (the first), or what it changed from the words before it (`diff`, null
 * when it changed nothing), or its error. */
export interface ShownStep {
  step: VoiceStep
  diff: Piece[] | null
  full: boolean
}

const base = (name: string) => name.replace(/_\d+$/, '')
const tryOf = (name: string) => +(/_(\d+)$/.exec(name)?.[1] || 1)

/** The steps in the order their words arrived: a retry (`pro_2`) starts when the try before it ends, so it arrives
 * after it; the others by how long they took; the tidied words last, compared with the words chosen. */
export function stepsInOrder(steps: readonly VoiceStep[]): ShownStep[] {
  const arrived = new Map<VoiceStep, number>()
  const at = (s: VoiceStep): number => {
    const got = arrived.get(s)
    if (got !== undefined) return got
    const n = tryOf(s.step)
    const before = n > 1 ? steps.find((x) => base(x.step) === base(s.step) && tryOf(x.step) === n - 1) : undefined
    const t = (before ? at(before) : 0) + (s.secs ?? 0)
    arrived.set(s, t)
    return t
  }
  const heard = steps.filter((s) => s.step !== 'tidy').sort((x, y) => at(x) - at(y))
  const tidy = steps.filter((s) => s.step === 'tidy')
  const chosen = heard.find((s) => s.chosen && s.text)?.text
  const out: ShownStep[] = []
  let last: string | undefined
  for (const s of heard) {
    if (s.error || !s.text) out.push({ step: s, diff: null, full: false })
    else {
      out.push(last === undefined ? { step: s, diff: null, full: true } : { step: s, diff: last === s.text ? null : wordDiff(last, s.text), full: false })
      last = s.text
    }
  }
  for (const s of tidy) {
    const from = chosen ?? last
    if (s.error || !s.text || from === undefined) out.push({ step: s, diff: null, full: !s.error && !!s.text })
    else out.push({ step: s, diff: from === s.text ? null : wordDiff(from, s.text), full: false })
  }
  return out
}

/** The steps to show for a voice note: its own, or (an older note, before steps were kept) its words as said and its
 * tidied words as the two steps they were. */
export function stepsOf(steps: readonly VoiceStep[], heard: string, tidied: string): VoiceStep[] {
  if (steps.length) return [...steps]
  if (heard && tidied && heard !== tidied) return [{ step: 'said', model: '', text: heard, chosen: true }, { step: 'tidy', model: '', text: tidied }]
  return [{ step: 'said', model: '', text: heard || tidied }]
}
