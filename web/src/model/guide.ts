// The guide agents read (GET /p/<project>/agent), laid out for a person: it is plain text in columns, kept word for
// word for the agents, so the page reads its layout instead. A line in capitals at the left ("READ  (plain text)",
// "LOOP  doing means…") or a "## " line starts a part; a line indented by two is a command with what it does after a
// gap of two spaces or more, or on the lines under it (a note when it is not a command); a line indented further
// continues the line before it; a here-document ("<<'EOF'" to "EOF") is an example. Nothing is dropped: every word
// of the guide is in what it gives.

export type GuidePart =
  /** `note`: what follows the name on its line, in brackets ("(plain text)") */
  | { kind: 'heading'; text: string; note: string }
  | { kind: 'text'; text: string }
  | { kind: 'rows'; rows: { cmd: string; say: string }[] }
  | { kind: 'code'; text: string }

const PART = /^([A-Z]{2,}(?: [A-Z]{2,})*)(?:\s+(.*))?$/
const ROW = /^(\S.*?\S|\S)\s{2,}(\S.*)$/
/** a command alone on its line, what it does on the lines under it */
const CMD = /^(?:curl|new|ack) |^[A-Z]\d+ /

export function guideParts(guide: string): GuidePart[] {
  const parts: GuidePart[] = []
  let open: GuidePart | null = null // the part a further line continues
  let code = false
  const text = (t: string) => {
    if (open?.kind === 'text') open.text += ' ' + t
    else parts.push((open = { kind: 'text', text: t }))
  }
  for (const line of guide.split('\n')) {
    const t = line.trim()
    const indent = line.length - line.trimStart().length
    if (code && open?.kind === 'code') {
      open.text += '\n' + t
      if (t === 'EOF') code = false
      continue
    }
    if (!t) {
      open = null
      continue
    }
    const h = indent === 0 ? (/^#{1,3} (.+)$/.exec(t) ?? null) : null
    if (h) {
      parts.push({ kind: 'heading', text: h[1], note: '' })
      open = null
      continue
    }
    const p = indent === 0 ? PART.exec(t) : null
    if (p) {
      const rest = p[2] ?? ''
      const note = /^\(.*\):?$/.test(rest)
      parts.push({ kind: 'heading', text: p[1], note: note ? rest : '' })
      open = null
      if (rest && !note) text(rest)
      continue
    }
    if (indent === 0) {
      text(t)
      continue
    }
    if (indent >= 6 && open) {
      const o = open as GuidePart // `text` may have opened a paragraph: the compiler does not see it
      if (o.kind === 'rows') {
        const last = o.rows[o.rows.length - 1]
        last.say = last.say ? last.say + ' ' + t : t
      } else if (o.kind === 'text') o.text += ' ' + t
      else if (o.kind === 'code') o.text += '\n' + t
      continue
    }
    if (indent > 2 && open?.kind === 'rows') {
      const last = open.rows[open.rows.length - 1]
      last.cmd += '\n' + ' '.repeat(indent - 2) + t // its indent kept: it says the line is indented
      continue
    }
    if (/<<'EOF'$/.test(t)) {
      parts.push((open = { kind: 'code', text: t }))
      code = true
      continue
    }
    const r = ROW.exec(t) ?? (CMD.test(t) ? [t, t, ''] : null)
    if (r) {
      const row = { cmd: r[1], say: r[2] }
      if (open?.kind === 'rows') open.rows.push(row)
      else parts.push((open = { kind: 'rows', rows: [row] }))
      continue
    }
    text(t)
  }
  return parts
}
