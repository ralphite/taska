// I693 (r1116, r1118, r1128): what Yadong decided about the rules document, as the page works it out. Change these only
// on his explicit word, and cite it.
import { describe, expect, test } from 'vitest'
import { diffChunks, foldRuns, historyRows, lineCounts, placeDoc, readRulesView, rulesSeg, waitingProposals } from './rules'
import { HISTORY, PROPOSAL, rulesDocOf } from '../stories/rulesFixtures'
import { modelOf } from '../stories/fixtures'

describe('a version shows its changes in place, one column (r1128 #8)', () => {
  test('added and removed lines are marked, the rest is as it was', () => {
    const c = diffChunks('## A\n\n- one\n- two', '## A\n\n- one\n- three')
    expect(c).toEqual([
      { mark: '', text: '## A' },
      { mark: '', text: '- one' },
      { mark: 'removed', text: '- two' },
      { mark: 'added', text: '- three' },
    ])
    expect(lineCounts('## A\n\n- one\n- two', '## A\n\n- one\n- three')).toEqual({ add: 1, del: 1 })
  })

  test('the unchanged text between changes folds into one line; nothing changed, or all new: all of it', () => {
    const before = ['## A', '- a', '## B', '- b', '## C', '- c', '## D', '- d'].join('\n')
    const shown = foldRuns(diffChunks(before, before.replace('- d', '- dd')))
    expect(shown.map((s) => s.kind)).toEqual(['fold', 'chunk', 'chunk', 'chunk'])
    expect(foldRuns(diffChunks('', before)).every((s) => s.kind === 'chunk')).toBe(true)
  })
})

describe('the history (r1128 #5)', () => {
  test('newest first, by day, every why kept newest first, the newest is Now', () => {
    const rows = historyRows(rulesDocOf(), Date.parse(HISTORY.at(-1)!.t) + 60_000)
    expect(rows.map((r) => r.v)).toEqual([7, 6, 5, 4, 3, 2, 1])
    expect(rows[0]).toMatchObject({ now: true, who: 'You', day: 'Today', whys: ['Commits in the imperative', 'Name the verbs'] })
    expect(rows.at(-1)).toMatchObject({ who: 'Taska', whys: ['Rules moved into one document'] })
  })
})

describe('the Rules tab (r1128 #9)', () => {
  test('its addresses: the document, the history, a version, against now, a proposal', () => {
    for (const at of ['', 'history', 'v5', 'v5/now', 'p12']) expect(rulesSeg(readRulesView(at))).toBe(at)
  })

  test('only a proposal waiting counts as waiting on you', () => {
    expect(waitingProposals(rulesDocOf()).map((p) => p.id)).toEqual([PROPOSAL.id])
    expect(waitingProposals(rulesDocOf(HISTORY, [{ ...PROPOSAL, state: 'approved' }]))).toEqual([])
  })

  test('a comment on the rules goes to the rules document, read or on one of its pages', () => {
    const m = { ...modelOf([]), docs: [rulesDocOf()] }
    expect(placeDoc({ tab: 'rules', place: { kind: 'tab' } }, m)).toBe(5)
    expect(placeDoc({ tab: 'rules', place: { kind: 'rules' } }, m)).toBe(5)
    expect(placeDoc({ tab: 'items', place: { kind: 'tab' } }, m)).toBe(null)
  })
})
