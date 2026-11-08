// Taska out of reach (T728 #8): one count, one threshold, one set of words, and no place with its own.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'
import { AWAY, awayAfter, outOfReach, REACH_WORDS } from './reach'

describe('how sure the page is', () => {
  test('two tries without an answer, or one that timed out', () => {
    expect(outOfReach(awayAfter(0, false))).toBe(false)
    expect(outOfReach(awayAfter(awayAfter(0, false), false))).toBe(true)
    expect(outOfReach(awayAfter(0, true))).toBe(true)
    expect(AWAY).toBe(2)
  })
})

/** the page's own source (not its tests or stories) */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === 'stories' || n === 'test' ? [] : sources(p)
    return /\.tsx?$/.test(n) && !/\.(test|stories)\.tsx?$/.test(n) ? [p] : []
  })
}

test('T728: every place says it in these words and counts with this threshold', () => {
  const src = join(__dirname, '..')
  const own = sources(src).filter((p) => !p.endsWith(join('model', 'reach.ts')))
  expect(own.length).toBeGreaterThan(100)
  const words = Object.values(REACH_WORDS)
  for (const p of own) {
    // the words in a comment are fine; in a string, they are a place's own
    const code = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    for (const w of words) expect(code.includes(w), `${relative(src, p)} says "${w}" itself: use REACH_WORDS`).toBe(false)
    expect(/away\s*>=\s*\d/.test(code), `${relative(src, p)} has its own threshold: use outOfReach`).toBe(false)
  }
})
