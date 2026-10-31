// The guide agents read, laid out for a person: its parts, and not a word of it lost.

import { describe, expect, it as test } from 'vitest'
import { GUIDE } from '../stories/guideFixture'
import { guideParts, type GuidePart } from './guide'

const words = (s: string) => s.split(/\s+/).filter(Boolean)
const partWords = (p: GuidePart) => (p.kind === 'rows' ? p.rows.flatMap((r) => [...words(r.cmd), ...words(r.say)]) : p.kind === 'heading' ? [...words(p.text), ...words(p.note)] : words(p.text))

describe('guideParts', () => {
  const parts = guideParts(GUIDE)

  test('keeps every word', () => {
    expect(parts.flatMap(partWords).sort()).toEqual(words(GUIDE.replace(/^## /gm, '')).sort())
  })

  test('a line in capitals starts a part; a bracket after it is its note, other words its first paragraph', () => {
    const heads = parts.filter((p) => p.kind === 'heading')
    expect(heads.map((h) => h.text)).toEqual(['READ', 'WRITE', 'LOOP', 'YOURS', 'Codex: visible worker sessions'])
    expect(heads[0]).toMatchObject({ note: '(plain text)' })
    const loop = parts.indexOf(heads[2])
    expect(parts[loop + 1]).toMatchObject({ kind: 'text', text: expect.stringMatching(/^doing means work has started .* end your turn\.$/) })
  })

  test('a command and what it does; a further line continues what it does, a line under the command adds to it', () => {
    const rows = parts.flatMap((p) => (p.kind === 'rows' ? p.rows : []))
    expect(rows[0]).toEqual({ cmd: 'curl -s BASE/next', say: 'what to do now: the inbox first, items the user replied on, then the next item  <- start here' })
    expect(rows.find((r) => r.cmd === 'curl -s BASE/items')?.say).toMatch(/\[\^parent\] flag: \? you asked .* filters: \?q=word/)
    expect(rows.find((r) => r.cmd.startsWith('new bug'))?.cmd).toBe('new bug P1 now parent=B03 src=r12 Export ignores the active filter\n  <optional body, indented>')
  })

  test('a here-document is one example, its lines kept', () => {
    expect(parts.find((p) => p.kind === 'code')).toEqual({ kind: 'code', text: "curl -s BASE/do --data-binary @- <<'EOF'\nB03 doing\nB03 progress Reproduced it: the export ignores the filter\nEOF" })
  })

  test('a line of two spaces with no gap is a note, joined with the lines it continues', () => {
    expect(parts).toContainEqual({ kind: 'text', text: 'optional on any call: &session=<the title your app shows for this session> (or the header X-Taska-Session), so the user can tell your sessions apart' })
  })
})
