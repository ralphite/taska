import { expect, test } from 'vitest'
import { ASKS, lost, wordsOf, type Words } from './words'

// T806 #7: one way to wait for a voice note's words; Taska tries a failed one again itself, so the page never does
const said = (state: Words['state'], extra: Partial<Words> = {}) => ({ f: 'f1', state, done: state !== 'wait', tr: '', tr_error: '', ...extra }) as Words

test('it asks while Taska still works on the words, and takes the first answer that is in', async () => {
  const answers = [said('wait'), said('wait'), said('done', { tr: 'Keep the sort.' })]
  let asked = 0
  const w = await wordsOf(async () => answers[asked++])
  expect([asked, w.tr]).toEqual([3, 'Keep the sort.'])
})

test('a failed answer is final: it is not asked again', async () => {
  let asked = 0
  const w = await wordsOf(async () => (asked++, said('failed', { tr_error: 'Gemini HTTP 503' })))
  expect([asked, w.state]).toEqual([1, 'failed'])
})

test('words that never come: it gives up after its asks', async () => {
  let asked = 0
  const w = await wordsOf(async () => (asked++, said('wait')))
  expect([asked, w.state]).toEqual([ASKS, 'wait'])
})

test('a note Taska does not have goes up again', () => {
  expect(lost(said('failed', { tr_error: 'no such voice note' }))).toBe(true)
  expect(lost(said('failed', { tr_error: 'Gemini HTTP 503' }))).toBe(false)
})
