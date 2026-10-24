// The project's change log as the page says it: each change as a sentence (who, then what it did), the codes of
// items and inputs in it that are here as links, and the time. Also what a line is about (its item, else its
// document, else its input), and what an Undo of one of your changes says.

import { codeOf, type ProjectModel } from './project'
import type { LogRow, UndoEntry } from './types'
import { DID, STATUS_WORD, WHEN_WORD, inputCode, whoName } from './words'

export type LogPart = string | { n: number; code: string } | { id: string; code: string }

export interface LogSentence {
  key: string
  who: string
  session: string
  parts: LogPart[]
  /** "10-23 14:30" */
  time: string
}

type World = Pick<ProjectModel, 'byN' | 'byId' | 'docs' | 'width'>

const FLD = 'status|when|pri|type|archived|parent|title|body|next'
const SAYS: Record<string, string> = {
  say: 'said',
  ask: 'asked',
  block: 'is blocked:',
  propose: 'proposed',
  progress: 'progress:',
  decide: 'decided',
  withdraw: 'took back the question:',
}
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
const word = (map: Record<string, string>, v: string) => (Object.hasOwn(map, v) ? map[v] : v)

function setPart(m: World, f: string, a: string, b: string): string {
  if (f === 'status') return `${word(STATUS_WORD, a)} → ${word(STATUS_WORD, b)}`
  if (f === 'when') return `${word(WHEN_WORD, a)} → ${word(WHEN_WORD, b)}`
  if (f === 'archived') return b === 'True' ? 'archived' : 'unarchived'
  if (f === 'pri') return `priority ${a} → ${b}`
  if (f === 'type') return `type ${cap(a)} → ${cap(b)}`
  if (f === 'parent') return /^\d+$/.test(b) ? `moved under ${codeOf(m, Number(b))}` : /^\d+$/.test(a) ? `taken out from under ${codeOf(m, Number(a))}` : 'parent changed'
  if (f === 'title') return `renamed “${b}”`
  return f === 'body' ? 'description edited' : 'next step edited'
}

/** What a change did, in words. */
function said(m: World, what: string): string {
  return what
    .replace(/\*\*|__|`/g, '')
    .replace(/\[src=[^\]]*\]/g, '')
    .replace(/(^|\s)- (?:\( \)|\[ \]) /g, '$1')
    .replace(/ ''$/, ' a voice note')
    .replace(/^in (r\d+)(?: →([A-Z]\d+))? /, (_, r: string, c?: string) => (c ? `wrote ${r} to ${c} ` : `wrote ${r} `))
    .replace(/^new ([A-Z]\d+) (\w+) (P\d) (now|later) (.*?)(?: ←(r\d+))?$/s, (_, c: string, t: string, p: string, w: string, title: string, r?: string) => `made ${c}, ${/^[aeiou]/.test(t) ? 'an' : 'a'} ${t} (${p}${w === 'later' ? ', later' : ''}): ${title}${r ? ` from ${r}` : ''}`)
    .replace(new RegExp(`\\b(${FLD}) (.*?)→(.*?)(?=, (?:${FLD}) |$| \\(undo #)`, 'gs'), (_, f: string, a: string, b: string) => setPart(m, f, a, b))
    .replace(/ \(undo #(\d+)\)$/, ' (undoing #$1)')
    .replace(/^ack (.+)$/, (_, rs: string) => `saw ${rs.split(' ').join(', ')}`)
    .replace(/^doc (D\d+) on ([A-Z]\d+) /, 'wrote $1 on $2: ')
    .replace(/^(D\d+) comment /, 'commented on $1: ')
    .replace(/^(undo|redo) organizer changes for (r\d+)$/, (_, k: string, r: string) => (k === 'undo' ? `undid the filing of ${r}` : `put back the filing of ${r}`))
    .replace(/^(r\d+) (edit|append): /, (_, r: string, k: string) => (k === 'edit' ? `edited ${r}: ` : `added details to ${r}: `))
    .replace(/^organizer (r\d+) retry$/, 'filed $1 again')
    .replace(/^organizer (r\d+) (ok|FAILED): /, (_, r: string, k: string) => (k === 'ok' ? `filed ${r}: ` : `could not file ${r}: `))
    .replace(/\b(say|ask|block|propose|progress|decide|withdraw) (?=['"])/g, (_, k: string) => `${SAYS[k]} `)
}

/** The codes in it that are here, as links (an item by its code as written now; an input as #12). */
function linked(m: World, text: string): LogPart[] {
  const out: LogPart[] = []
  let at = 0
  for (const x of text.matchAll(/\b([A-Z]\d{1,5})\b|\b(r\d+)\b/g)) {
    const c = x[0]
    let part: LogPart = c
    if (x[1]) {
      const n = Number(c.slice(1))
      if (m.byN.has(n) && codeOf(m, n) === c) part = { n, code: c }
    } else part = m.byId.has(c) ? { id: c, code: inputCode(c) } : inputCode(c)
    if (typeof part === 'string' && part === c) continue
    out.push(text.slice(at, x.index), part)
    at = x.index + c.length
  }
  out.push(text.slice(at))
  return out.filter((p) => p !== '')
}

export function logSentence(m: World, e: LogRow): LogSentence {
  return {
    key: '#' + e.seq,
    who: whoName(e.who),
    session: e.ses || '',
    parts: linked(m, said(m, e.what)),
    time: `${e.t.slice(5, 10)} ${e.t.slice(11, 16)}`,
  }
}

/** What a line is about, to open beside the list: its item, else its document, else its input. */
export function logTarget(m: World, e: LogRow): { n: number } | { d: number } | { id: string } | null {
  for (const c of e.what.match(/\b[A-Z]\d{1,5}\b/g) || []) {
    const k = Number(c.slice(1))
    if (c[0] === 'D' && m.docs.some((d) => d.d === k)) return { d: k }
    if (m.byN.has(k) && codeOf(m, k) === c) return { n: k }
  }
  const r = /\br\d+\b/.exec(e.what)?.[0]
  return r && m.byId.has(r) ? { id: r } : null
}

/** What undoing one of your changes says it undid: "F12 is done". */
export function undoLabel(m: World, u: UndoEntry): string {
  const f = u.f
  const w = u.was
  const c = codeOf(m, u.n)
  if ('status' in f) return f.status === 'done' && w.status === 'review' ? `${c} accepted` : f.status === 'open' && w.status === 'proposed' ? `${c} approved` : `${c} ${DID[String(f.status)] || String(f.status)}`
  if ('archived' in f) return `${c} ${f.archived ? 'archived' : 'unarchived'}`
  if ('when' in f) return `${c} ${DID[String(f.when)]}`
  if ('pri' in f) return `${c} ${String(w.pri)} → ${String(f.pri)}`
  if ('type' in f) return `${c} became a ${String(f.type)}`
  if ('parent' in f) return f.parent ? `${c} moved under ${codeOf(m, f.parent as number)}` : `${c} stands on its own`
  return `${c} ${Object.keys(f).join(' and ')} edited`
}
