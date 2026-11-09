// The project's change log as the page says it: each change, from its facts, as a sentence (who, then what it did),
// the items and inputs in it that are here as links, and the time. Also what a line is about (its document, else its
// item, else its input), and what an Undo of one of your changes says.

import { codeOf, type ProjectModel } from './project'
import { when } from './time'
import type { LogField, LogRow, UndoEntry } from './types'
import { DID, STATUS_WORD, WHEN_WORD, inputCode } from './words'

/** words, a code that opens its item or input, or (`faint`) an item's title after its code */
export type LogPart = string | { n: number; code: string } | { id: string; code: string } | { faint: string }

export interface LogSentence {
  key: string
  /** who did it, by key (drawn by its app's icon where it has one, T711); '' for you */
  who: string
  session: string
  parts: LogPart[]
  /** "10-23 14:30" */
  time: string
}

type World = Pick<ProjectModel, 'byN' | 'byId' | 'docs' | 'width' | 'at'>

/** What a message of each kind says it did. */
const SAYS: Record<string, string> = {
  say: 'said',
  ask: 'asked',
  propose: 'proposed',
  progress: 'progress:',
  decide: 'decided',
  withdraw: 'took back the question:',
}
/** The changes to an item that name its title after its code, so what Undo would undo is plain (D115 r1079 #2). */
const TITLED: readonly string[] = ['status', 'when', 'pri', 'archived']
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
const word = (map: Record<string, string>, v: unknown) => {
  const s = v == null ? '' : String(v)
  return Object.hasOwn(map, s) ? map[s] : s
}
const an = (s: string) => (/^[aeiou]/.test(s) ? 'an' : 'a')

/** Words someone wrote, plain: no Markdown marks, no source tags, no checkboxes. */
const plain = (s: string) =>
  s
    .replace(/\*\*|__|`/g, '')
    .replace(/\[src=[^\]]*\]/g, '')
    .replace(/(^|\s)- (?:\( \)|\[ \]) /g, '$1')

/** The codes in words someone wrote that are here, as links (an item by its code as written now; an input as #12). */
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
  return out
}

/** Words of one change: what it names, as parts. */
function sentence(m: World, e: LogRow): LogPart[] {
  const item = (n: number): LogPart => (m.byN.has(n) ? { n, code: codeOf(m, n) } : (e.codes?.[n] ?? codeOf(m, n)))
  const input = (id: string | undefined): LogPart => (id && m.byId.has(id) ? { id, code: inputCode(id) } : id ? inputCode(id) : 'None')
  const items = (ns: readonly number[]) => ns.flatMap((n, i) => (i ? [' ', item(n)] : [item(n)]))
  /** what someone wrote, in quotes; none: a voice note */
  const quoted = (s: string, none = 'a voice note'): LogPart[] => (s ? ['“', ...linked(m, plain(s)), '”'] : [none])
  const doc = (d: number) => `D${d}`
  const set = (x: LogField): LogPart[] => {
    const { field: f, was, now } = x
    if (f === 'status') return [`${word(STATUS_WORD, was)} → ${word(STATUS_WORD, now)}`]
    if (f === 'when') return [`${word(WHEN_WORD, was)} → ${word(WHEN_WORD, now)}`]
    if (f === 'archived') return [now === true ? 'archived' : 'unarchived']
    if (f === 'pri') return [`priority ${String(was ?? '')} → ${String(now)}`]
    if (f === 'type') return [`type ${cap(String(was ?? ''))} → ${cap(String(now))}`]
    if (f === 'parent') return typeof now === 'number' ? ['moved under ', item(now)] : typeof was === 'number' ? ['taken out from under ', item(was)] : ['parent changed']
    if (f === 'title') return ['renamed ', ...quoted(String(now ?? ''), '“”')]
    if (f === 'body') return ['description edited']
    if (f === 'next') return ['next step edited']
    return [`${f} ${String(was ?? '')}→${String(now)}`]
  }
  switch (e.kind) {
    case 'in':
      return ['wrote ', input(e.id), ...(e.to ? [' to ', item(e.to)] : []), ' ', ...quoted(e.text)]
    case 'add':
      return ['made ', item(e.n), `, ${an(e.type)} ${e.type} (${e.pri}${e.when === 'later' ? ', later' : ''}): `, ...quoted(e.title, '“”'), ...(e.src ? [' from ', input(e.src)] : [])]
    case 'set': {
      const head: LogPart[] = [item(e.n)]
      const it = m.byN.get(e.n)
      if (it && TITLED.includes(e.set[0]?.field)) head.push({ faint: ' ' + it.title })
      return [...head, ' ', ...e.set.flatMap((x, i) => (i ? [', ', ...set(x)] : set(x))), ...(e.undo ? [` (undoing #${e.undo})`] : [])]
    }
    case 'say':
      return [item(e.n), ` ${SAYS[e.as] ?? e.as} `, ...quoted(e.text)]
    case 'merge':
      return [item(e.n), ' merged into ', item(e.into)]
    case 'unmerge':
      return [item(e.n), ' taken out of ', item(e.into)]
    case 'due':
      return [item(e.n), ' back to now (its day came)']
    case 'ack':
      return ['saw ', ...e.ids.flatMap((id, i) => (i ? [', ', input(id)] : [input(id)]))]
    case 'cfg':
      return ['renamed the project ', ...quoted(e.name, '“”')]
    case 'doc':
      return [`wrote ${doc(e.d)} on `, item(e.n), ': ', ...quoted(e.title, '“”')]
    case 'dc':
      return [`commented on ${doc(e.d)}: `, ...quoted(e.text)]
    case 'dcedit':
      return [`edited a comment on ${doc(e.d)}: `, ...quoted(e.text)]
    case 'dcres':
      return [`${e.on ? 'resolved' : 'reopened'} a thread on ${doc(e.d)}`]
    case 'dcdel':
      return [`deleted a comment on ${doc(e.d)}`]
    case 'dcundel':
      return [`restored a comment on ${doc(e.d)}`]
    case 'dcmove':
      return [`moved a comment on ${doc(e.d)}`]
    case 'ddel':
      return [`${e.on ? 'deleted' : 'restored'} ${doc(e.d)}`]
    case 'dmove':
      return [`${doc(e.d)} moved to `, item(e.to)]
    case 'voice': {
      const note: LogPart[] = e.src ? [input(e.src), ' voice note'] : ['a voice note']
      if (e.state === 'wait') return e.text ? [...note, ' first words: ', ...quoted(e.text)] : [...note, ' being transcribed']
      if (e.state === 'done') return [...note, ' words: ', ...quoted(e.text)]
      return [...note, e.state === 'none' ? ': no words heard' : ': transcription failed']
    }
    case 'voicefix':
      return [...(e.src ? [input(e.src), ' '] : []), 'voice note words corrected: ', ...quoted(e.text)]
    case 'voices':
      return [`kept each voice note's words in one place (${e.count} voice notes)`]
    case 'folded':
      return [`an earlier kind of change (${e.was}), folded in`]
    case 'undo':
      return ['undid the filing of ', input(e.src)]
    case 'redo':
      return ['put back the filing of ', input(e.src)]
    case 'send':
      return [input(e.src), ' sent (it was a cancelled recording)']
    case 'del':
    case 'undel': {
      const kept = e.kind === 'del' ? e.kept : []
      return [
        input(e.src),
        e.kind === 'del' ? ' deleted' : ' restored',
        ...(e.ns.length ? [' with ', ...items(e.ns)] : []),
        ...(kept.length ? ['; kept ', ...kept.flatMap(([n, why], i) => [...(i ? [', '] : []), item(n), ` (${why})`])] : []),
      ]
    }
    case 'arch':
      return [`${e.on ? 'archived' : 'unarchived'} ${e.count}: `, ...items(e.ns), ...(e.count > e.ns.length ? [' …'] : [])]
    case 'idel':
      return ['deleted ', ...items(e.ns)]
    case 'iundel':
      return ['restored ', ...items(e.ns)]
    case 'moved':
      return [input(e.src), ` moved to ${e.to} as ${inputCode(e.as)}`]
    case 'amend':
      return [...(e.mode === 'edit' ? ['edited ', input(e.src)] : e.mode === 'append' ? ['added details to ', input(e.src)] : [input(e.src), ` ${e.mode}`]), ': ', ...quoted(e.text)]
    case 'unfile':
      return [`took ${e.f} off `, ...(e.d ? [`a comment on ${doc(e.d)}`] : [input(e.src)])]
    case 'hide':
      return [`${e.on ? 'hid' : 'showed'} a message on `, item(e.n)]
    case 'rescope':
      return [input(e.src), ' now goes with ', item(e.to)]
    case 'org':
      if (e.retry) return ['filed ', input(e.src), ' again']
      return [e.ok ? 'filed ' : 'could not file ', input(e.src), ': ', ...linked(m, plain(e.msg || ''))]
    case 'other':
      return linked(m, `${e.name} ${e.id ?? ''}`.trimEnd())
  }
}

/** The parts with the words beside each other in one run, and none empty. */
function joined(parts: LogPart[]): LogPart[] {
  const out: LogPart[] = []
  for (const p of parts) {
    const last = out.at(-1)
    if (p === '') continue
    if (typeof p === 'string' && typeof last === 'string') out[out.length - 1] = last + p
    else out.push(p)
  }
  return out
}

export function logSentence(m: World, e: LogRow): LogSentence {
  return {
    key: '#' + e.seq,
    // your own changes need no name (single user)
    who: e.who === 'you' ? '' : e.who,
    session: e.ses || '',
    parts: joined(sentence(m, e)),
    time: when(e.t, m.at),
  }
}

/** What a line is about, to open beside the list: the first item or document it names that is here, else the first
 * input. */
export function logTarget(m: World, e: LogRow): { n: number } | { d: number } | { id: string } | null {
  const parts = sentence(m, e)
  for (const p of parts) {
    if (typeof p !== 'string') {
      if ('n' in p) return { n: p.n }
      continue
    }
    for (const x of p.matchAll(/\bD(\d{1,5})\b/g)) {
      const d = Number(x[1])
      if (m.docs.some((y) => y.d === d)) return { d }
    }
  }
  const inp = parts.find((p) => typeof p !== 'string' && 'id' in p)
  return inp ? { id: (inp as { id: string }).id } : null
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

/** Activity's rows: each change in words, whether it opens what it changed, and whether it can be undone. */
export const activityRows = (m: ProjectModel, rows: readonly LogRow[]) => rows.map((e) => ({ s: logSentence(m, e), opens: !!logTarget(m, e), undo: m.facts.undo.find((u) => u.seq === e.seq)?.seq ?? null }))
