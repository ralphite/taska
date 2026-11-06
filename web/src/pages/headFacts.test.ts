// I693 (r1128 #9): the Rules tab is the rules document; it says a number only while a proposed change waits on you.
import { expect, test } from 'vitest'
import { NO_FILTERS } from '../model/route'
import { HISTORY, PROPOSAL, rulesDocOf } from '../stories/rulesFixtures'
import { modelOf } from '../stories/fixtures'
import { tabCounts } from './headFacts'

test('the Rules tab counts the proposals waiting, nothing else', () => {
  const m = { ...modelOf([]), docs: [rulesDocOf()] }
  expect(tabCounts(m, 'rules', NO_FILTERS, true).rules).toBe(1)
  expect(tabCounts({ ...m, docs: [rulesDocOf(HISTORY, [{ ...PROPOSAL, state: 'declined' }])] }, 'rules', NO_FILTERS, true).rules).toBe('')
})
