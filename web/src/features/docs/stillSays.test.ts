import { describe, expect, it } from 'vitest'
import { stillSays } from './WebPage'

describe('a comment on a web page stays on its part only while the part still says it (T432 #5145, T802)', () => {
  it('stays when the words are there, however they wrap', () => {
    expect(stillSays('Seat holds  last\nfive minutes, then go back.', 'Seat holds last five minutes')).toBe(true)
  })
  it('goes to "its words changed" when the part says something else now', () => {
    expect(stillSays('Seats are held for ten minutes.', 'Seat holds last five minutes')).toBe(false)
  })
  it('stays while the page has not said its words yet', () => {
    expect(stillSays(undefined, 'Seat holds last five minutes')).toBe(true)
  })
})
