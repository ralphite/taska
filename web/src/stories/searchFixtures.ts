// The phone's search (F479): the demo project Shop (and Home), and what each thing you might say finds, in the shape
// the server sends (/api/find): the words heard first (one word misheard), set right, then with more said.
import type { HeardFile } from '../model/doubts'
import type { FindAnswer, Found } from '../model/find'
import type { Item } from '../model/types'
import { doc } from './docFixtures'
import { T, input, item, message, modelOf } from './fixtures'
import { PROJECT } from './listFixtures'

const F1: Item = {
  ...PROJECT[0],
  body: 'The export writes **every** row; it should write the rows the list shows, with the filter and the sort.',
  thread: [
    message({ id: 2, by: 'you', kind: 'say', text: 'The export should keep the filter I set.', t: '2026-10-23T14:10:00-07:00' }),
    message({ id: 3, text: 'Reproduced it: the export reads the list before the filter.', t: '2026-10-23T14:20:00-07:00' }),
  ],
}
const B18 = item({
  n: 18,
  type: 'bug',
  pri: 'P1',
  title: 'On the phone the export ignores the filter',
  body: 'On the phone the export writes every row again, whatever the filter.',
  thread: [message({ id: 5, by: 'you', kind: 'say', text: 'On my phone the export gives me every row again.', t: '2026-11-02T09:12:00-08:00' })],
})
export const ITEMS: Item[] = [F1, ...PROJECT.slice(1), B18]
export const D1 = doc({ d: 1, n: 1, title: 'Plan: the export keeps the filter' })
const INPUTS = [
  input({ id: 'r12', text: 'On my phone the export gives me every row again.', acked: true, touched: [18] }),
  input({ id: 'r8', text: 'The export should keep the filter I set.', acked: true, touched: [1] }),
]
export const SHOP = modelOf(ITEMS, INPUTS, { title: 'Shop', agents: [{ name: 'claude-code', t: Date.parse(T), waiting: true }], work: true }, [D1])
const H21 = item({ n: 21, title: 'Export contacts with the sort kept' })
export const HOME = modelOf([H21], [], { title: 'Home' })
/** The projects in the sidebar's order. */
export const ORDER = ['shop', 'home']

const it = (n: number): Found => ({ project: 'shop', kind: 'items', key: 'i' + n, n })
/** a section of the rules (I693) */
const RULES0: Found = { project: 'shop', kind: 'rules', key: 's0', n: null, code: 'Rules', title: 'Exports write what the list shows' }
const SAID8: Found = { project: 'shop', kind: 'inputs', key: 'r8', n: 1, code: '#8', title: 'The export should keep the filter I set.', t: '2026-10-23T14:10:00-07:00', became: 'F001' }
const SAID12: Found = { project: 'shop', kind: 'inputs', key: 'r12', n: 18, code: '#12', title: 'On my phone the export gives me every row again.', t: '2026-11-02T09:12:00-08:00', became: 'B018' }
const DOC1: Found = { project: 'shop', kind: 'docs', key: 'd1', n: 1, code: 'D1', d: 1, title: D1.title, on: 'F001' }
// another project's item comes with what the list shows of it
const HOME21: Found = { project: 'home', kind: 'items', key: 'i21', n: 21, item: { ...H21, code: 'F021' }, parentCode: null, kids: null }
const HOME4: Found = { project: 'home', kind: 'inputs', key: 'r4', n: 21, code: '#4', title: 'When I export contacts the order is gone', t: '2026-10-20T19:02:00-07:00', became: 'F021' }

const answer = (q: string, marks: string[], found: Found[]): FindAnswer => ({ q, by: 'meaning', marks, found, titles: { shop: 'Shop', home: 'Home' } })
export const MISHEARD = answer('where the expert loses my filter', ['filter'], [it(1), SAID8, DOC1, it(3), it(14), RULES0, HOME21, HOME4])
export const RIGHT = answer('where the export loses my filter', ['export', 'filter'], [it(1), SAID8, DOC1, it(3), it(14), it(6), RULES0, HOME21, HOME4])
/** What you say more, the second time. */
export const ADDED = ', only on the phone'
export const MORE = answer(RIGHT.q + ADDED, ['export', 'filter', 'phone'], [it(18), SAID12, it(1), it(9), RULES0])
/** What it finds for the words in the box (anything else typed: nothing). */
export function searchOf(words: string): FindAnswer | null {
  const w = words.toLowerCase()
  if (w.includes('phone')) return { ...MORE, q: words }
  if (w.includes('expert')) return { ...MISHEARD, q: words }
  if (w.includes('export') || w.includes('filter')) return { ...RIGHT, q: words }
  return null
}
/** The misheard word in the first words: the main model heard "expert", the other "export". */
export const HEARD: HeardFile[] = [{ key: 's1', trAdded: MISHEARD.q, doubts: [{ was: 'expert', alt: 'export', why: 'two models', show: ['expert', 'export'] }] }]
