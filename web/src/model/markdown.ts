// Text as the page shows it everywhere (messages, descriptions, inputs, comments, documents): Taska's Markdown, read
// into blocks. Paragraphs keep their line breaks; lists nest by their indent (two spaces a level); a table needs its
// alignment row; ``` fences code. In a question, "- ( ) option" lines are choices to pick one of and "- [ ] option"
// lines choices to pick any of. Pure: the words of a block stay Markdown, for the inline reading (ui/markdown).

export type Align = 'text-left' | 'text-center' | 'text-right'

export interface ListNode {
  ordered: boolean
  items: { text: string; subs: ListNode[] }[]
}

export type MdBlock =
  | { kind: 'para'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; list: ListNode }
  | { kind: 'table'; head: string[]; align: Align[]; rows: string[][] }
  | { kind: 'code'; text: string }
  /** a run of choices; `base` is the first one's number among all the choices of the text */
  | { kind: 'choices'; multi: boolean; labels: string[]; base: number }

export const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
export const CHOICE = /^\s*[-*+]\s+(\(|\[)[ xX]?(\)|\])\s+/
const LIST_LINE = /^\s*([-*+]|\d+[.)])\s/

export const hasChoices = (text: unknown) =>
  String(text || '')
    .split('\n')
    .some((l) => CHOICE.test(l))

/** The lines of a text in runs of one kind: a paragraph, a list, a quote; headings, code and tables alone. */
function runs(text: string): { kind: string; lines: string[] }[] {
  const lines = text.replace(/\r/g, '').split('\n')
  type Run = { kind: string; lines: string[] }
  const out: Run[] = []
  let cur: Run | null = null
  const add = (kind: string, line: string) => {
    let run = cur
    if (run?.kind !== kind) out.push((run = cur = { kind, lines: [] }))
    run.lines.push(line)
  }
  const open = (): Run | null => cur
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^\s*```/.test(l)) {
      const from = i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) i++
      out.push({ kind: 'code', lines: lines.slice(from, i + 1) })
      cur = null
    } else if (!l.trim()) cur = null
    else if (/^#{1,6}\s/.test(l)) {
      out.push({ kind: 'heading', lines: [l] })
      cur = null
    } else if (/^\s*>/.test(l)) add('quote', l)
    else if (LIST_LINE.test(l)) add(/^\s*\d/.test(l) ? 'ol' : 'ul', l)
    else if ((open()?.kind === 'ol' || open()?.kind === 'ul') && /^\s{2,}\S/.test(l)) open()?.lines.push(l) // a list item goes on
    else if (/^\s*\|/.test(l) && TABLE_SEP.test(lines[i + 1] || '')) {
      const from = i
      i += 2
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++
      out.push({ kind: 'table', lines: lines.slice(from, i--) })
      cur = null
    } else add('para', l)
  }
  return out
}

/** A list's lines as a tree: an item indented two spaces more is a level deeper, under the item before it. */
export function listOf(text: string): ListNode | null {
  const items: { lv: number; ol: boolean; t: string }[] = []
  for (const l of text.split('\n')) {
    const m = /^(\s*)([-*+]|\d+[.)])\s+/.exec(l)
    if (m) items.push({ lv: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ol: /\d/.test(m[2]), t: l.slice(m[0].length) })
    else if (items.length) items[items.length - 1].t += ' ' + l.trim()
  }
  const nest = (from: number, lv: number): [ListNode, number] => {
    const node: ListNode = { ordered: items[from].ol, items: [] }
    let i = from
    while (i < items.length && items[i].lv >= lv) {
      if (items[i].lv > lv) {
        const [sub, next] = nest(i, items[i].lv)
        node.items[node.items.length - 1]?.subs.push(sub)
        i = next
        continue
      }
      node.items.push({ text: items[i].t, subs: [] })
      i++
    }
    return [node, i]
  }
  return items.length ? nest(0, items[0].lv)[0] : null
}

function tableOf(lines: string[]): MdBlock {
  const cells = (l: string) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .replace(/\\\|/g, '\ue002')
      .split('|')
      .map((c) => c.trim().replace(/\ue002/g, '|'))
  const [head, sep, ...rows] = lines.join('\n').trim().split('\n').map(cells)
  const align = (sep || []).map((c): Align => (/^:-+:$/.test(c) ? 'text-center' : /-:$/.test(c) ? 'text-right' : 'text-left'))
  return { kind: 'table', head, align, rows }
}

/** A list run's items, each with the lines that go on it, as one line. */
const itemsOf = (lines: string[]) =>
  lines.reduce<string[]>((acc, l) => {
    if (/^\s*[-*+]\s/.test(l)) acc.push(l)
    else acc[acc.length - 1] += ' ' + l.trim()
    return acc
  }, [])

/**
 * The blocks of a text. `asking`: it is a question that can be answered (or was): its choices count also when its
 * list has other points before them.
 */
export function blocks(text: string, asking = false): MdBlock[] {
  const out: MdBlock[] = []
  let choices = 0
  for (const r of runs(text)) {
    if (r.kind === 'code') {
      out.push({ kind: 'code', text: r.lines.join('\n').replace(/^\s*```[^\n]*\n?/, '').replace(/\n?\s*```\s*$/, '') })
      continue
    }
    if (r.kind === 'heading') {
      const l = r.lines[0]
      out.push({ kind: 'heading', level: (l.match(/^#+/) || ['#'])[0].length, text: l.replace(/^#+\s*/, '') })
      continue
    }
    if (r.kind === 'quote') {
      out.push({ kind: 'quote', text: r.lines.join('\n').replace(/^\s*>\s?/gm, '') })
      continue
    }
    if (r.kind === 'table') {
      out.push(tableOf(r.lines))
      continue
    }
    if (r.kind === 'para') {
      out.push({ kind: 'para', text: r.lines.join('\n') })
      continue
    }
    const items = r.kind === 'ul' ? itemsOf(r.lines) : []
    if (items.length && (items.every((l) => CHOICE.test(l)) || (asking && items.some((l) => CHOICE.test(l))))) {
      // the list in runs: its plain points as a list, its choices as choices
      const parts: { c: boolean; ls: string[] }[] = []
      for (const l of items) {
        const c = CHOICE.test(l)
        if (parts.at(-1)?.c !== c) parts.push({ c, ls: [] })
        parts.at(-1)?.ls.push(l)
      }
      for (const p of parts) {
        if (!p.c) {
          const list = listOf(p.ls.join('\n'))
          if (list) out.push({ kind: 'list', list })
          continue
        }
        const labels = p.ls.map((l) => l.replace(CHOICE, ''))
        out.push({ kind: 'choices', multi: p.ls[0].match(CHOICE)?.[1] === '[', labels, base: choices })
        choices += labels.length
      }
      continue
    }
    const list = listOf(r.lines.join('\n'))
    if (list) out.push({ kind: 'list', list })
  }
  return out
}

/** Whether the i-th choice of a text is one of a pick-any list. */
export const choiceMulti = (text: string, i: number) =>
  blocks(text, true).some((b) => b.kind === 'choices' && i >= b.base && i < b.base + b.labels.length && b.multi)

/** Every choice of a text, in order: what an answer's ticks are matched against. */
export const choiceLabels = (text: string) => blocks(text, true).flatMap((b) => (b.kind === 'choices' ? b.labels : []))

/** The picks of an answer ("✓ option" lines). */
export const ticks = (text: string) =>
  text
    .split('\n')
    .map((l) => l.match(/^\s*✓\s*(.+)$/)?.[1]?.trim())
    .filter(Boolean) as string[]

/** A quote from a document read as words: no ** or `, no table pipes or rules. */
export const plainQuote = (s: unknown) =>
  String(s || '')
    .split('\n')
    .filter((l) => !TABLE_SEP.test(l))
    .map((l) =>
      l
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s*(#+|>|[-*+]|\d+[.)])\s+/, '')
        .replace(/\*\*|__|`/g, '')
        .replace(/^\s*\||\|\s*$/g, '')
        .replace(/\s*\|\s*/g, ' · ')
        .trim(),
    )
    .filter(Boolean)
    .join(' ')
