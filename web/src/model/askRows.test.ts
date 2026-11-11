// B749 (D132): an agent's questions in a row are one card; your answer to some of them names them and says each on a
// line, the others still wait; anything said after the row answers them all.
import { describe, expect, test } from 'vitest'
import { item, message } from '../stories/fixtures'
import { talkPlan } from './needStates'
import { answerOf, askRows, rowAnswer } from './talk'

const a = message({ id: 1, kind: 'ask', text: 'Turn the page by itself?\n- ( ) Yes\n- ( ) No' })
const b = message({ id: 2, kind: 'ask', text: 'Which ones?\n- [ ] Phone\n- [ ] Desk' })
const c = message({ id: 3, kind: 'ask', text: 'What else?' })
const part = message({ id: 4, by: 'you', kind: 'say', text: '- Turn the page by itself? → ✓ Yes\n- Which ones? → ✓ Phone ✓ Desk', of: [1, 2] })

describe('questions in a row', () => {
  test('asks one after another are a row; anything else between ends it, and one alone is no row', () => {
    expect(askRows([a, b, c]).map((r) => r.map((x) => x.id))).toEqual([[1, 2, 3]])
    expect(askRows([a, message({ id: 9, text: 'On it' }), b])).toEqual([])
    expect(askRows([a, b, part, c]).map((r) => r.map((x) => x.id))).toEqual([[1, 2, 3]])
  })

  test('an answer to some: each named one by its line, the others not yet', () => {
    const th = [a, b, c, part]
    expect(rowAnswer(th, [a, b, c], a)).toEqual({ picked: ['Yes'], words: '' })
    expect(rowAnswer(th, [a, b, c], b)).toEqual({ picked: ['Phone', 'Desk'], words: '' })
    expect(rowAnswer(th, [a, b, c], c)).toBeNull()
    const words = message({ id: 5, by: 'you', kind: 'say', text: '- What else? → A long one', of: [3] })
    expect(rowAnswer([...th, words], [a, b, c], c)).toEqual({ picked: [], words: 'A long one' })
  })

  test('words after the row answer every question in it', () => {
    const th = [a, b, c, message({ id: 6, by: 'you', kind: 'say', text: 'All yes' })]
    expect(answerOf(th, a)).toEqual([])
    expect(rowAnswer(th, [a, b, c], c)).toEqual({ picked: [], words: 'All yes' })
  })

  test('the card goes where the last of the row is, even when an earlier one is what still waits', () => {
    const it = item({ n: 1, thread: [a, b, c, message({ id: 5, by: 'you', kind: 'say', text: '- What else? → x', of: [3] })], wait: { id: 2, kind: 'ask', text: b.text, by: b.by, files: [] } })
    expect(talkPlan(it).cardId).toBe(3)
  })
})
