// Taska's Markdown read into blocks, and the talk's rules that read it (what an answer picked).

import { describe, expect, it as test } from 'vitest'
import { item, message } from '../stories/fixtures'
import { blocks, choiceLabels, listOf, plainQuote, ticks } from './markdown'
import { answerOf, answeredLast, decidedCard, talkPlan, versions, withdrawn } from './talk'

describe('blocks', () => {
  test('paragraphs keep their line breaks; a blank line starts another', () => {
    expect(blocks('one\ntwo\n\nthree')).toEqual([
      { kind: 'para', text: 'one\ntwo' },
      { kind: 'para', text: 'three' },
    ])
  })

  test('headings, quotes, code and tables stand alone', () => {
    const b = blocks('# Plan\n> a\n> b\n```\nx = 1\n```\n| A | B |\n|---|--:|\n| 1 | 2 |')
    expect(b.map((x) => x.kind)).toEqual(['heading', 'quote', 'code', 'table'])
    expect(b[0]).toEqual({ kind: 'heading', level: 1, text: 'Plan' })
    expect(b[1]).toEqual({ kind: 'quote', text: 'a\nb' })
    expect(b[2]).toEqual({ kind: 'code', text: 'x = 1' })
    expect(b[3]).toEqual({ kind: 'table', head: ['A', 'B'], align: ['text-left', 'text-right'], rows: [['1', '2']] })
  })

  test('a list nests by two spaces a level; a line that goes on joins its item', () => {
    expect(listOf('- a\n  - b\n    more\n- c')).toEqual({
      ordered: false,
      items: [
        { text: 'a', subs: [{ ordered: false, items: [{ text: 'b more', subs: [] }] }] },
        { text: 'c', subs: [] },
      ],
    })
  })

  test('choices: a list of them; in a question also after other points', () => {
    const q = 'Pick:\n\n- ( ) CSV\n- ( ) Excel'
    expect(blocks(q)[1]).toEqual({ kind: 'choices', multi: false, labels: ['CSV', 'Excel'], base: 0 })
    const mixed = '- a point\n- [ ] one\n- [ ] two'
    expect(blocks(mixed).map((b) => b.kind)).toEqual(['list'])
    expect(blocks(mixed, true).map((b) => b.kind)).toEqual(['list', 'choices'])
    expect(choiceLabels('- ( ) a\n\nwords\n\n- ( ) b')).toEqual(['a', 'b'])
  })

  test('ticks and quotes read as words', () => {
    expect(ticks('✓ CSV\n✓  Excel\nnote')).toEqual(['CSV', 'Excel'])
    expect(plainQuote('**Bold** and `code`\n| a | b |')).toBe('Bold and code a · b')
  })
})

describe('the talk', () => {
  const ask = message({ id: 2, kind: 'ask', text: 'Which?\n\n- ( ) CSV\n- ( ) Excel' })
  const answer = message({ id: 3, by: 'you', kind: 'say', text: '✓ Excel' })

  test('an answer is your words after the question, the latest one counting; one on its way counts first', () => {
    expect(answerOf([ask, answer], ask)).toEqual(['Excel'])
    expect(answerOf([ask, answer, message({ id: 4, by: 'you', kind: 'say', text: '✓ CSV' })], ask)).toEqual(['CSV'])
    expect(answerOf([ask], ask, '✓ CSV')).toEqual(['CSV'])
    expect(answerOf([ask], ask)).toBeNull()
    expect(answeredLast(item({ n: 1, thread: [ask, answer] }))).toBe(true)
  })

  test('your decision shows while it is the latest word', () => {
    const p = message({ id: 5, kind: 'propose', text: 'Do it' })
    const decided = item({ n: 1, status: 'open', thread: [p], decided: { from: 'proposed', to: 'open', msg: 5, t: '' } })
    expect(decidedCard(decided)?.dec.to).toBe('open')
    expect(decidedCard({ ...decided, thread: [p, message({ id: 6, text: 'Started' })] })).toBeNull()
  })

  test('a question taken back; an input you edited, as its versions', () => {
    const q = message({ id: 1, kind: 'ask', text: '?' })
    expect([...withdrawn([q, message({ id: 2, kind: 'withdraw', text: '' })])]).toEqual([1])
    const v = versions([message({ id: 1, by: 'you', src: 'r1', text: 'Keep the filter' }), message({ id: 2, by: 'you', src: 'r1', text: 'r1 updated:\nKeep the filter and the sort' })])
    expect(v.get(2)).toEqual({ old: false, text: 'and the sort', label: 'added details' })
  })

  test('the talk folds what came before its last eight messages, never the card', () => {
    const long = item({ n: 1, thread: Array.from({ length: 12 }, (_, i) => message({ id: i + 1 })) })
    expect(talkPlan(long, { all: false }).hidden).toBe(4)
    expect(talkPlan(long, { all: true }).hidden).toBe(0)
  })
})
