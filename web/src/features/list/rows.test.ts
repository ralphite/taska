// B699 (r1126): a row you acted on stays the row it was while the list holds still: same kind, same place, its title
// struck and its button saying what you did; it is not swapped for another view of another height. Change only on
// Yadong's explicit word.
import { describe, expect, test } from 'vitest'
import { item, modelOf } from '../../stories/fixtures'
import { NO_FILTERS } from '../../model/route'
import { heldMark, heldRows, listBody, type Row } from './rows'

const st = { folded: new Set<number>(), subMore: new Set<number>(), needsAll: false, open: null, desk: false }
const waiting = item({ n: 3, status: 'review', title: 'Keep the filter in the export' })
const other = item({ n: 4, status: 'proposed', title: 'Sort by priority' })
const rowsOf = (items: ReturnType<typeof item>[], q = { ...NO_FILTERS, status: 'wait' }) => {
  const b = listBody(modelOf(items), 'items', q, st)
  return b.kind === 'rows' ? b.rows : []
}
const kinds = (rows: Row[]) => rows.map((r) => (r.kind === 'item' || r.kind === 'needs' ? `${r.kind} ${r.it.n}${r.said ? ` ${r.said}` : ''}` : r.kind))

describe('a row you just acted on, while the list holds still', () => {
  test('accepted in Needs you: the same Needs-you row, where it was, saying Accepted with its own button', () => {
    const before = rowsOf([waiting, other])
    const accepted = { ...waiting, status: 'done' as const }
    const now = heldRows(before, modelOf([accepted, other]), 'items', { ...NO_FILTERS, status: 'wait' }, new Map([[3, heldMark({ said: 'Accepted', f: 'status', v: 'done' })]]))
    expect(kinds(now)).toEqual(kinds(before).map((k) => (k === 'needs 3' ? 'needs 3 Accepted' : k)))
    const row = now.find((r) => r.kind === 'needs' && r.it.n === 3)
    expect(row && row.kind === 'needs' ? row.act : null).toBe('accept')
  })

  test('approved: its button stays Approve, saying Approved', () => {
    const before = rowsOf([waiting, other])
    const approved = { ...other, status: 'open' as const }
    const now = heldRows(before, modelOf([waiting, approved]), 'items', { ...NO_FILTERS, status: 'wait' }, new Map([[4, heldMark({ said: 'Approved', f: 'status', v: 'open' })]]))
    const row = now.find((r) => r.kind === 'needs' && r.it.n === 4)
    expect(row && row.kind === 'needs' ? [row.said, row.act] : null).toEqual(['Approved', 'approve'])
  })

  // B766 (Yadong r1293 r1294): struck says done, dropped or not needed; an approved item is work to do: never struck
  test('B766: approved is not struck, also before Taska has it; accepted and declined are', () => {
    const before = rowsOf([waiting, other])
    const mark = (said: string, v: string) => new Map([[4, heldMark({ said, f: 'status', v })]])
    const row = (held: ReturnType<typeof mark>) => heldRows(before, modelOf([waiting, other]), 'items', { ...NO_FILTERS, status: 'wait' }, held).find((r) => r.kind === 'needs' && r.it.n === 4)
    const approved = row(mark('Approved', 'open'))
    expect(approved && approved.kind === 'needs' ? [approved.said, approved.struck] : null).toEqual(['Approved', false])
    expect(row(mark('Declined', 'dropped'))).toMatchObject({ said: 'Declined', struck: true })
    expect(row(mark('Sent back', 'doing'))).toMatchObject({ struck: false })
    expect(heldMark({ said: 'Accepted', f: 'status', v: 'done' }).struck).toBe(true)
  })
})
