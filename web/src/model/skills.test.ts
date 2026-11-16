import { describe, expect, test } from 'vitest'
import { pickedSkill, skillMenu, skillsOf } from './skills'
import type { SharedRule } from './types'

const rule = (name: string, md: string): SharedRule => ({ slug: '~a', name, md, parts: [], used: [] })
const skills = skillsOf([rule('编程', '## 测试'), rule('/qa', '回答问题，只答不做。\n\n- 只回答'), rule('/plan', '# Plan it first')])

describe('skills in the box (I821)', () => {
  test('the shared rules named /name, each with what it is for', () => {
    expect(skills).toEqual([
      { name: '/plan', what: 'Plan it first' },
      { name: '/qa', what: '回答问题，只答不做。' },
    ])
  })
  test('"/" at the start lists them; the letters typed narrow the list, any case', () => {
    expect(skillMenu('/', skills)?.map((s) => s.name)).toEqual(['/plan', '/qa'])
    expect(skillMenu('/Q', skills)?.map((s) => s.name)).toEqual(['/qa'])
  })
  test('no list once something else is typed, after a space, elsewhere than the start, or when none fits', () => {
    for (const text of ['', 'a /qa', '/qa ', '/qa what', '/x', ' /qa']) expect(skillMenu(text, skills)).toBeNull()
  })
  test('picking one puts its name and a space in the box', () => {
    expect(pickedSkill(skills[1])).toBe('/qa ')
  })
})
