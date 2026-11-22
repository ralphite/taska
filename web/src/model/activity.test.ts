import { describe, expect, test } from 'vitest'
import { task, modelOf } from '../stories/fixtures'
import { logSentence, logTarget } from './activity'
import type { LogRow } from './types'

const m = modelOf([task({ n: 624, title: 'Storybook against the product' }), task({ n: 625, tags: ['bug'], title: 'A → in a title' })])
const row = (x: object) => ({ seq: 1, t: '2026-11-05T16:55:00-08:00', who: 'you', ...x }) as LogRow
const line = (x: object) => logSentence(m, row(x)).parts

describe('a line of Activity', () => {
  // round 8 (as D115 r1079 #2 has it for rows just acted on): what Undo would undo is plain
  test("a status change names the task's title after its code", () => {
    expect(line({ kind: 'set', n: 624, set: [{ field: 'status', was: 'review', now: 'done' }] })).toEqual([{ n: 624, code: 'T624' }, { faint: ' Storybook against the product' }, ' In review → Done'])
  })

  test('other lines stay as they are', () => {
    expect(line({ kind: 'set', n: 624, set: [{ field: 'title', was: 'Old', now: 'Storybook against the product' }] })).toEqual([{ n: 624, code: 'T624' }, ' renamed “Storybook against the product”'])
  })

  test('it is said from its facts: an arrow or a quote in what was written is only words', () => {
    expect(line({ kind: 'set', n: 625, set: [{ field: 'title', was: 'x', now: "A → in a title, it's" }] })).toEqual([{ n: 625, code: 'T625' }, " renamed “A → in a title, it's”"])
    expect(line({ kind: 'set', n: 624, set: [{ field: 'archived', was: false, now: true }] })).toEqual([{ n: 624, code: 'T624' }, { faint: ' Storybook against the product' }, ' archived'])
    expect(line({ kind: 'say', n: 624, as: 'ask', text: 'Which one, T625?' })).toEqual([{ n: 624, code: 'T624' }, ' asked “Which one, ', { n: 625, code: 'T625' }, '?”'])
  })

  test('what it opens: its document, else the first task here, else its input', () => {
    expect(logTarget(m, row({ kind: 'merge', n: 9, into: 625, codes: { 9: 'I9', 625: 'T625' } }))).toEqual({ n: 625 })
    expect(logTarget(m, row({ kind: 'ack', ids: ['r1'] }))).toEqual(null)
  })
})
