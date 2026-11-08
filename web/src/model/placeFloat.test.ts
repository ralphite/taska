// B715 r1169: a place's comment buttons float near it, under it or else over it, never pushing the page's words.
import { expect, test } from 'vitest'
import { floatOver } from './placeFloat'

const SCREEN = { top: 0, bottom: 800 }

test('B715 r1169: under the place when the screen has room under it', () => {
  expect(floatOver({ top: 100, bottom: 200 }, 56, 6, SCREEN)).toBe(false)
  expect(floatOver({ top: 600, bottom: 738 }, 56, 6, SCREEN)).toBe(false) // just fits
})

test('B715 r1169: over the place when the screen has no room under it', () => {
  expect(floatOver({ top: 600, bottom: 760 }, 56, 6, SCREEN)).toBe(true)
  expect(floatOver({ top: 600, bottom: 900 }, 56, 6, SCREEN)).toBe(true) // its end below the screen
})

test('B715 r1169: under it all the same when there is no room over it either (a place taller than the screen)', () => {
  expect(floatOver({ top: 20, bottom: 790 }, 56, 6, SCREEN)).toBe(false)
})

test('B715 r1169: under a place out of sight (nothing to keep in view)', () => {
  expect(floatOver({ top: 900, bottom: 1000 }, 56, 6, SCREEN)).toBe(false)
  expect(floatOver({ top: -300, bottom: -100 }, 56, 6, SCREEN)).toBe(false)
})
