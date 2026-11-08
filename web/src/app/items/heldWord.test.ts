import { describe, expect, test } from 'vitest'
import { decidedWord } from '../../model/needStates'
import { heldWord } from './itemActions'

describe('a row just changed says it in a few words', () => {
  test('done, not the sentence', () => {
    expect(heldWord('status', 'open', 'approved')).toBe('Approved')
    expect(heldWord('status', 'dropped', "is marked won't do")).toBe("Won't do")
    expect(heldWord('status', 'done', 'is done')).toBe('Done')
    expect(heldWord('when', 'later', 'moved to Later')).toBe('Moved to Later')
    expect(heldWord('when', 'now', 'is back to now')).toBe('Back to now')
    expect(heldWord('pri', 'P1', 'is now P1')).toBe('P1')
  })
  test('a decision as its card says it once made (D115 #8)', () => {
    const d = (from: string, to: string) => decidedWord({ from, to, msg: null, t: '' })
    expect([d('proposed', 'open'), d('proposed', 'dropped'), d('review', 'done'), d('review', 'open')]).toEqual(['Approved', 'Declined', 'Accepted', 'Sent back'])
  })
})
