// Shared rules in a project's rules (I779, D134): a line of its own `{{编程}}` puts the shared rules 编程 there,
// `{{编程 › 测试}}` only its section 测试. The server keeps the line and gives readers the text in its place
// (server/taska/domain/includes.py); the page reads the lines the same way: which a paragraph has, what each puts in
// (the shared rule's text, or one of the sections the server lists), which name nothing, and where Insert puts one.
// Pure.

import type { SharedRule } from './types'

/** A shared rule's address: `~<id>`, never a project's. */
export const isSharedSlug = (slug: string) => slug.startsWith('~')

const LINE = /^\{\{\s*([^{}›>\n]+?)\s*(?:[›>]\s*([^{}\n]+?)\s*)?\}\}$/

export interface Include {
  name: string
  /** a section of it; null: the whole of it */
  part: string | null
  /** the line as written */
  line: string
  /** what the page calls it: 编程, 编程 › 测试 */
  label: string
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).join(' ')
/** a name as it is matched: its words, any case, any spacing */
export const norm = (s: string) => words(s).toLowerCase()

export function includeOf(line: string): Include | null {
  const m = LINE.exec(line.trim())
  if (!m) return null
  const name = words(m[1])
  const part = m[2] ? words(m[2]) : null
  return { name, part, line: line.trim(), label: part ? `${name} › ${part}` : name }
}

/** The line that puts it in. */
export const lineOf = (name: string, part: string | null = null) => (part ? `{{${name} › ${part}}}` : `{{${name}}}`)

/** The lines that put shared rules in, in order (none in a code block). */
export function includes(md: string): Include[] {
  const out: Include[] = []
  let fence = false
  for (const l of md.split('\n')) {
    if (l.trimStart().startsWith('```')) fence = !fence
    else if (!fence) {
      const i = includeOf(l)
      if (i) out.push(i)
    }
  }
  return out
}

export const ruleOf = (rules: readonly SharedRule[], name: string) => rules.find((r) => norm(r.name) === norm(name))

/** What a line puts in its place: the shared rule and the text; null: no shared rules by that name, or no such
 * section in them. */
export function resolve(inc: Include, rules: readonly SharedRule[]): { rule: SharedRule; md: string } | null {
  const rule = ruleOf(rules, inc.name)
  if (!rule) return null
  if (!inc.part) return { rule, md: rule.md }
  const want = norm(inc.part)
  const p = rule.parts.find((x) => norm(x.name) === want || norm(x.title) === want)
  return p ? { rule, md: p.md } : null
}

/** The lines whose names are not found (while the shared rules are not here yet, none). */
export const notFound = (md: string, rules: readonly SharedRule[] | null): string[] => (rules ? includes(md).filter((i) => !resolve(i, rules)).map((i) => i.label) : [])

/** How many projects put it in. */
export const usedCount = (r: SharedRule) => new Set(r.used.map((u) => u.project)).size

/** A paragraph cut at its lines: each line, and the words between them. null: it has none. */
export type Run = { kind: 'include'; inc: Include } | { kind: 'text'; text: string }
export function runsOf(text: string): Run[] | null {
  const ls = text.split('\n')
  if (!ls.some((l) => includeOf(l))) return null
  const out: Run[] = []
  for (const l of ls) {
    const inc = includeOf(l)
    const last = out.at(-1)
    if (inc) out.push({ kind: 'include', inc })
    else if (last?.kind === 'text') last.text += '\n' + l
    else if (l.trim()) out.push({ kind: 'text', text: l })
  }
  return out.map((r) => (r.kind === 'text' ? { ...r, text: r.text.trim() } : r)).filter((r) => r.kind === 'include' || r.text)
}

/** The text with a line put in where the caret is, on a line of its own (a blank line before and after it), and the
 * caret after it. */
export function insertLine(text: string, at: number, line: string): { text: string; caret: number } {
  // the caret inside a line: the new one goes after that line
  const end = text.indexOf('\n', at)
  const i = at > 0 && text[at - 1] !== '\n' ? (end < 0 ? text.length : end) : at
  const before = text.slice(0, i)
  const after = text.slice(i)
  const pre = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const post = after.startsWith('\n\n') || !after ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const head = before + pre + line
  return { text: head + post + after, caret: head.length }
}

/** Whether the text puts this one in already (the same name and section, however written). */
export function hasLine(text: string, line: string): boolean {
  const want = includeOf(line)
  return !!want && includes(text).some((i) => norm(i.label) === norm(want.label))
}
