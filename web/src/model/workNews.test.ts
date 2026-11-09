import { describe, expect, test } from 'vitest'
import { item, message } from '../stories/fixtures'
import { workNews } from './items'

describe('work in progress: its latest news on its row (D115 #30)', () => {
  const T = Date.parse('2026-11-04T12:00:00Z')
  const at = (min: number) => new Date(T - min * 60e3).toISOString()
  test("the agent's last words and how long ago; amber past an hour", () => {
    const it = item({ n: 1, status: 'doing', thread: [message({ id: 1, text: 'Reproduced it.', t: at(90) }), message({ id: 2, text: '**Testing** with three filters\nmore', t: at(12) })] })
    expect(workNews(it, T)).toEqual({ text: 'Testing with three filters', age: '12m', quiet: false })
    expect(workNews({ ...it, thread: it.thread.slice(0, 1) }, T)).toEqual({ text: 'Reproduced it.', age: '2h', quiet: true })
  })
  test('not your words, the organizer, or a hidden message; none: null', () => {
    const it = item({ n: 1, status: 'doing', thread: [message({ id: 1, by: 'you', kind: 'say', t: at(1) }), message({ id: 2, by: 'org', kind: 'say', text: 'Added to F1', t: at(1) }), message({ id: 3, hidden: true, t: at(1) })] })
    expect(workNews(it, T)).toBeNull()
  })
})
