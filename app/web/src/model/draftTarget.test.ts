import { describe, expect, it } from 'vitest'
import { draftKey, draftName, draftTarget, keyOf } from './draftTarget'

describe('draft targets', () => {
  it('read the keys the browser keeps, and make them again as they were', () => {
    for (const k of ['new', 'rule', 'prefs', 'F12', 'doc 4', 'edit r12', 'append r12', 'correct r3', 'dc 5 12', 'dc 12', 'sending abc1'])
      expect(draftKey(draftTarget(k))).toBe(k)
    expect(draftTarget('doc 4')).toEqual({ kind: 'doc', d: 4 })
    expect(draftTarget('edit r12')).toEqual({ kind: 'amend', mode: 'edit', id: 'r12' })
    expect(draftTarget('dc 12')).toEqual({ kind: 'comment', d: null, id: 12 })
    expect(draftTarget('F12')).toEqual({ kind: 'reply', code: 'F12' })
    expect(draftTarget('who knows')).toEqual({ kind: 'other', key: 'who knows' })
    expect(keyOf('who knows')).toBe('who knows')
  })
  it('name them as the page says them', () => {
    expect(draftName('new')).toBe('a new input')
    expect(draftName('rule')).toBe('a new rule')
    expect(draftName('B12')).toBe('B12')
    expect(draftName('edit r461')).toBe('the edit of #461')
    expect(draftName('append r461')).toBe('the details for #461')
    expect(draftName('correct r3')).toBe('the correction in #3')
    expect(draftName('doc 4')).toBe('the comment on D4')
    expect(draftName('dc 5 12')).toBe('the edit of comment 12')
  })
})
