// I693 r1128: old texts keep their rule codes (R055) as plain words, no longer links; inputs are r12 / #12.
import { expect, test } from 'vitest'
import { input, modelOf } from '../stories/fixtures'
import { findRef } from './project'

test('an old rule code is plain text, an input code still links', () => {
  const m = modelOf([], [input({ id: 'r73', text: 'x' })])
  expect(findRef(m, 'R73')).toBeNull()
  expect(findRef(m, 'r73')).toEqual({ kind: 'input', id: 'r73' })
  expect(findRef(m, '#73')).toEqual({ kind: 'input', id: 'r73' })
})
