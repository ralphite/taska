import { describe, expect, test } from 'vitest'
import { item, modelOf } from '../stories/fixtures'
import { logSentence } from './activity'

const m = modelOf([item({ n: 624, type: 'task', title: 'Storybook against the product' })])
const line = (what: string) => logSentence(m, { seq: 1, t: '2026-11-05T16:55:00-08:00', who: 'you', what } as never).parts

describe('a line of Activity', () => {
  // round 8 (as D115 r1079 #2 has it for rows just acted on): what Undo would undo is plain
  test("a status change names the item's title after its code", () => {
    expect(line('T624 status review→done')).toEqual([{ n: 624, code: 'T624' }, { faint: ' Storybook against the product' }, ' In review → Done'])
  })

  test('other lines stay as they are', () => {
    expect(line('T624 title Old→Storybook against the product')).toEqual([{ n: 624, code: 'T624' }, ' renamed “Storybook against the product”'])
  })
})
