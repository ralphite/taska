// The page's copies of the server's rules agree with the server on its own cases (refactor 2): tools/rule_cases.py ran
// domain/rules.py and agent_text/work.py on fresh projects (model/ruleCases.gen.ts); the words come from
// domain/vocab.py (model/vocab.gen.ts).

import { describe, expect, it as test } from 'vitest'
import { closed, heldItems, queueHead, queueOrder, userWord } from './items'
import { needsYou } from './needStates'
import { NEEDS, NEXT, QUEUE, USER_WORDS } from './ruleCases.gen'
import type { Input, Item } from './types'
import { CLOSED, STATUSES } from './vocab.gen'

describe("the server's rules, on the server's cases", () => {
  test('finished: done and won’t do (CLOSED)', () => {
    for (const s of STATUSES) expect(closed(s), s).toBe((CLOSED as readonly string[]).includes(s))
  })

  test('what needs you (needs_you): every status, asked or not, answered or not, archived or not, merged', () => {
    for (const it of NEEDS.items) expect(needsYou(it), `${it.n} ${it.title}`).toBe(NEEDS.needs[String(it.n)])
  })

  test("the user's own words (user_word): everyone's messages of every kind", () => {
    for (const c of USER_WORDS) expect(userWord(c), JSON.stringify(c)).toBe(c.user)
  })

  test('the order agents take the work (queue_order)', () => {
    for (const c of QUEUE) {
      const now = c.items.filter((it: Item) => it.when === 'now')
      expect(queueOrder(now).map((it) => it.n)).toEqual(c.order)
    }
  })

  test('the item /next hands out next (next_work): replied on, held for a voice note, the queue', () => {
    for (const c of NEXT) {
      // the server's held inputs, as the page sees them: a voice note whose words are being worked out
      const inputs = c.inputs.map((r: Input) => (c.held.includes(r.id) ? { ...r, files: r.files.map((f) => ({ ...f, voice: { f: f.f, state: 'wait' as const, said: '', tidied: '' } })) } : r))
      expect(queueHead(c.items, heldItems(inputs)) ?? null, c.items.map((it) => `${it.n} ${it.pri} ${it.when} ${it.status}`).join(', ')).toBe(c.next)
    }
  })
})
