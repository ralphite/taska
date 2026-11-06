import { describe, expect, test } from 'vitest'
import { FOLD_FROM, shownLines } from './MsgText'

// F692 (r1113): Show more only from 20 lines; change only on Yadong's explicit word
describe('when a message folds', () => {
  test('from 20 lines as it reads', () => {
    expect(FOLD_FROM).toBe(20)
    expect(shownLines(Array.from({ length: 19 }, (_, i) => `line ${i}`).join('\n'), false)).toBe(19)
  })

  test('a long line counts as the lines it wraps to; Chinese takes twice the room', () => {
    expect(shownLines('a'.repeat(88), false)).toBe(2)
    expect(shownLines('中'.repeat(44), false)).toBe(2)
    expect(shownLines('中'.repeat(44), true)).toBe(1)
  })
})
