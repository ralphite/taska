// F479's prototype (searchProto.tsx): the demo project Shop (and Home), and what each thing you might say finds: the
// words heard first (one word misheard), set right, then with more said. Each result says why it is there.
import type { HeardFile } from '../model/doubts'
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
const R17 = item({ n: 17, type: 'rule', title: 'Exports write what the list shows' })
const B18 = item({
  n: 18,
  type: 'bug',
  pri: 'P1',
  title: 'On the phone the export ignores the filter',
  body: 'On the phone the export writes every row again, whatever the filter.',
  thread: [message({ id: 5, by: 'you', kind: 'say', text: 'On my phone the export gives me every row again.', t: '2026-11-02T09:12:00-08:00' })],
})
export const ITEMS: Item[] = [F1, ...PROJECT.slice(1), R17, B18]
export const D1 = doc({ d: 1, n: 1, title: 'Plan: the export keeps the filter' })
const INPUTS = [
  input({ id: 'r12', text: 'On my phone the export gives me every row again.', acked: true, touched: [18] }),
  input({ id: 'r8', text: 'The export should keep the filter I set.', acked: true, touched: [1] }),
]
export const SHOP = modelOf(ITEMS, INPUTS, { title: 'Shop', agents: [{ name: 'claude-code', t: Date.parse(T), waiting: true }], work: true }, [D1])
export const HOME = modelOf([item({ n: 21, title: 'Export contacts with the sort kept' })], [], { title: 'Home' })

export type Kind = 'items' | 'inputs' | 'rules' | 'docs'
export const KINDS: [Kind, string][] = [
  ['items', 'Items'],
  ['inputs', 'Inputs'],
  ['rules', 'Rules'],
  ['docs', 'Documents'],
]
/** One thing a search found: an item (or rule) of this project or another, an input, a document; why it is there. */
export interface Found {
  kind: Kind
  key: string
  /** the item it is, or the one it opens (a document's item, what an input became) */
  n: number
  why: string
  /** found by its words too, so it shows before the search by meaning is back */
  byWords?: boolean
  /** another project's */
  home?: boolean
  /** a document or an input: its code, its words, what it is */
  code?: string
  title?: string
  meta?: string
}
const it = (n: number, why: string, byWords = false, kind: Kind = 'items'): Found => ({ kind, key: 'i' + n, n, why, byWords })
const SAID8: Found = { kind: 'inputs', key: 'r8', n: 1, code: '#8', title: 'The export should keep the filter I set.', meta: 'Oct 23 · became F001', why: 'When you asked for the export to keep it', byWords: true }
const SAID12: Found = { kind: 'inputs', key: 'r12', n: 18, code: '#12', title: 'On my phone the export gives me every row again.', meta: 'Today 09:12 · became B018', why: 'The same, said of the export on the phone' }
const DOC1: Found = { kind: 'docs', key: 'd1', n: 1, code: 'D1', title: D1.title, meta: 'On F001', why: 'The plan for making the export keep the filter' }
const HOME21: Found = { kind: 'items', key: 'h21', n: 21, home: true, why: 'The same trouble in Home: its export drops the sort' }

/** What a search found for some words. */
export interface Search {
  words: string
  /** the words it marks where they are found */
  marks: string[]
  found: Found[]
  /** found by the words only, so far: no why yet (an item says where the words are, as the list does) */
  byWords?: boolean
}
/** What the words alone find, at once, before the search by meaning is back. */
export const byWordsOf = (s: Search): Search => ({ ...s, byWords: true, found: s.found.filter((y) => y.byWords) })
export const MISHEARD: Search = {
  words: 'where the expert loses my filter',
  marks: ['filter'],
  found: [it(1, 'What you described: the export drops the filter you set', true), it(3, 'The filter, kept in what the export writes', true), it(14, 'Part of F001: where the export gets the filter from', true), it(17, 'What every export writes', false, 'rules'), SAID8, DOC1, HOME21],
}
export const RIGHT: Search = {
  words: 'where the export loses my filter',
  marks: ['export', 'filter'],
  found: [it(1, 'What you described: the export drops the filter you set', true), it(3, 'The filter, kept in what the export writes', true), it(14, 'Part of F001: where the export gets the filter from', true), it(6, 'Another export: it will need the filter too', true), it(17, 'What every export writes', false, 'rules'), SAID8, DOC1, HOME21],
}
/** What you say more, the second time. */
export const ADDED = ', only on the phone'
export const MORE: Search = {
  words: RIGHT.words + ADDED,
  marks: ['export', 'filter', 'phone'],
  found: [it(18, 'What you described, on the phone', true), it(1, 'The export drops the filter, on any screen', true), it(9, 'Another export trouble on the phone', true), it(17, 'What every export writes', false, 'rules'), SAID12],
}
/** What it finds for the words in the box (anything else typed: nothing). */
export function searchOf(words: string): Search | null {
  const w = words.toLowerCase()
  if (w.includes('phone')) return { ...MORE, words }
  if (w.includes('expert')) return { ...MISHEARD, words }
  if (w.includes('export') || w.includes('filter')) return { ...RIGHT, words }
  return null
}
/** The misheard word in the first words: the main model heard "expert", the other "export". */
export const HEARD: HeardFile[] = [{ key: 's1', trAdded: MISHEARD.words, doubts: [{ was: 'expert', alt: 'export', why: 'two models', show: ['expert', 'export'] }] }]
