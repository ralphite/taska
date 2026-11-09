// What an item needs from you (T728 #3): every state is worked out from the item and has a rule for every place, the
// list is the server's needs_you, the row, A and the card agree on one priority order, and docs/item-states.md is
// made from the table.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { item, message } from '../stories/fixtures'
import { forward } from './actions'
import { NEED_PLACES, NEED_STATES, NEED_STATE_LIST, needOf, needPlacesTable, needRow, needsYou, shownStatus, talkPlan, yourStep, type NeedState } from './needStates'
import type { Item } from './types'

const ask = message({ id: 2, kind: 'ask', text: 'Which?\n\n- ( ) CSV\n- ( ) Excel' })
const askWords = message({ id: 2, kind: 'ask', text: 'Keep the old export?' })
const answer = message({ id: 3, by: 'you', kind: 'say', text: '✓ Excel' })
const proposal = message({ id: 1, kind: 'propose', text: 'Add a CSV export' })
const waitOf = (x: typeof ask) => ({ id: x.id, kind: 'ask' as const, text: x.text, by: x.by, files: [] })

/** one of each state, as the page has the item */
const OF: Record<NeedState, Item> = {
  answer: item({ n: 1, thread: [askWords], wait: waitOf(askWords) }),
  approve: item({ n: 1, status: 'proposed', thread: [proposal] }),
  accept: item({ n: 1, status: 'review', thread: [message({ id: 1, text: 'Finished' })] }),
  onAnswer: item({ n: 1, status: 'proposed', talked: true, thread: [proposal, ask, answer] }),
  replied: item({ n: 1, status: 'proposed', talked: true, thread: [proposal, message({ id: 4, by: 'you', kind: 'say', text: 'Let us talk first' })] }),
  decided: item({ n: 1, status: 'open', thread: [proposal], decided: { from: 'proposed', to: 'open', msg: 1, t: '' } }),
  decidedOnAnswer: item({ n: 1, status: 'open', talked: true, thread: [proposal, ask, answer], decided: { from: 'proposed', to: 'open', msg: 2, t: '' } }),
  none: item({ n: 1 }),
}

describe('the states', () => {
  test('every state is worked out from the item, and has a rule for every place', () => {
    for (const s of NEED_STATE_LIST) expect(needOf(OF[s]).state, s).toBe(s)
    for (const s of NEED_STATE_LIST) for (const p of ['listed', 'row', 'mark', 'key', 'card']) expect(NEED_STATES[s], `${s}: ${p}`).toHaveProperty(p)
    expect(Object.keys(NEED_PLACES)).toEqual(['list', 'row', 'mark', 'key', 'card'])
  })

  test('a row in Needs you exactly for what is on the list; Needs you on its mark exactly while a question waits', () => {
    for (const s of NEED_STATE_LIST) {
      expect(!!needRow(OF[s]), s).toBe(needsYou(OF[s]))
      expect(shownStatus(OF[s]).s === 'wait', s).toBe(s === 'answer')
    }
  })
})

describe("the list is the server's needs_you (domain/rules.py)", () => {
  /** the server's rule, as it reads */
  const server = (it: Item) => !it.mergedInto && !it.archived && !['done', 'dropped'].includes(it.status) && (!!it.wait || (['proposed', 'review'].includes(it.status) && !it.talked))
  const all: Item[] = []
  for (const status of ['proposed', 'open', 'doing', 'review', 'done', 'dropped'] as const)
    for (const talked of [false, true])
      for (const archived of [false, true])
        for (const w of [null, waitOf(askWords)]) all.push(item({ n: 1, status, talked, archived, thread: w ? [proposal, askWords] : [proposal], wait: w }))
  test('the same for every status, talked or not, archived or not, a question or none', () => {
    for (const it of all) expect(needsYou(it), JSON.stringify({ s: it.status, t: it.talked, a: it.archived, w: !!it.wait })).toBe(server(it))
  })
  test('T728: a proposal of your own with only your words on it needs you, and its card is the proposal, not Skipped', () => {
    const mine = item({ n: 1, status: 'proposed', by: 'you', thread: [message({ id: 1, by: 'you', kind: 'say', text: 'Maybe a CSV export' })] })
    expect(needsYou(mine)).toBe(true)
    expect(NEED_STATES[needOf(mine).state].card).toBe('decide')
  })
})

describe('T728: one priority order for the row, A and the way forward', () => {
  test('a proposal with a question waiting: the row says Answer, and A and the swipe answer it (A approved it before)', () => {
    const it = item({ n: 1, status: 'proposed', thread: [proposal, ask], wait: waitOf(ask) })
    expect(needRow(it)?.act).toBe('answer')
    expect(yourStep(it)).toEqual({ answer: 'choices' })
    expect(forward(it)?.slice(0, 3)).toEqual(['need', 'answer', 'answer'])
  })
  test('finished work: Accept everywhere; you replied instead: off the list, A still accepts', () => {
    expect(needRow(OF.accept)).toMatchObject({ act: 'accept', word: 'Accept', line: 'Finished' })
    expect(yourStep(OF.accept)).toEqual({ set: ['status', 'done', 'accept', 'accepted'] })
    expect(needRow({ ...OF.replied, status: 'review' })).toBeNull()
    expect(yourStep({ ...OF.replied, status: 'review' })).toEqual({ set: ['status', 'done', 'accept', 'accepted'] })
  })
  test('decided: nothing for A, the card faded where it was', () => {
    expect(yourStep(OF.decided)).toBeNull()
    expect(yourStep(OF.decidedOnAnswer)).toBeNull()
    expect(talkPlan(OF.decided).cardId).toBe(1)
  })
})

describe("T728: the decided card and the answered question's button agree", () => {
  test('decided on a question with choices you answered: that card says what you chose; no card of its own', () => {
    const n = needOf(OF.decidedOnAnswer)
    expect(n).toMatchObject({ keep: 'decided', of: 'proposal', dec: { to: 'open' } })
    expect(talkPlan(OF.decidedOnAnswer).cardId).toBeNull()
  })
  test('decided while its question waits: the question’s card keeps the button, said as done (r1003)', () => {
    const it = item({ n: 1, status: 'open', thread: [proposal, askWords], wait: waitOf(askWords), decided: { from: 'proposed', to: 'open', msg: 2, t: '' } })
    expect(needOf(it)).toMatchObject({ state: 'answer', keep: 'decided', of: 'proposal' })
  })
  test('the agent spoke since: the decision no longer shows anywhere', () => {
    const later = { ...OF.decided, thread: [proposal, message({ id: 6, text: 'Started' })] }
    expect(needOf(later)).toMatchObject({ state: 'none', dec: null })
  })
})

test('docs/item-states.md shows the table made from this model', () => {
  const doc = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'item-states.md'), 'utf8')
  const table = needPlacesTable()
  expect(doc.includes(table), `docs/item-states.md: its table should be\n${table}`).toBe(true)
})
