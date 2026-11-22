// T779 (D134): the page reads a project's lines `{{name}}` / `{{name › section}}` as the server does
// (server/taska/domain/includes.py, tests/test_shared_rules.py): which lines a text has, what each puts in, which name
// nothing, where Insert puts one.
import { expect, test } from 'vitest'
import { hasLine, includeOf, includes, insertLine, isSharedSlug, notFound, resolve, runsOf, usedCount } from './includes'
import type { SharedRule } from './types'

const CODING: SharedRule = {
  slug: '~q8rt2',
  name: '编程',
  md: '## 需求（改功能时）\n\n- 先想。\n\n## 测试\n\n- 按风险测。',
  parts: [
    { name: '需求', title: '需求（改功能时）', md: '## 需求（改功能时）\n\n- 先想。' },
    { name: '测试', title: '测试', md: '## 测试\n\n- 按风险测。' },
  ],
  used: [
    { project: 'taska', title: 'Taska', line: '{{编程}}' },
    { project: 'taska', title: 'Taska', line: '{{编程 › 测试}}' },
    { project: 'shop', title: 'Shop', line: '{{编程}}' },
  ],
}

test('a line of its own, the whole or one section, "›" or ">", any spacing', () => {
  expect(includeOf('{{编程}}')).toEqual({ name: '编程', part: null, line: '{{编程}}', label: '编程' })
  expect(includeOf('  {{ 编程  >  测试 }} ')?.label).toBe('编程 › 测试')
  expect(includeOf('see {{编程}} here')).toBeNull()
  expect(includes('{{编程}}\n\n```\n{{通用}}\n```\n- a\n{{编程 › 测试}}').map((i) => i.label)).toEqual(['编程', '编程 › 测试'])
})

test('what a line puts in: the whole, a section by its short name or whole heading, any case', () => {
  expect(resolve(includeOf('{{编程}}')!, [CODING])?.md).toBe(CODING.md)
  expect(resolve(includeOf('{{编程 › 需求}}')!, [CODING])?.md).toBe(CODING.parts[0].md)
  expect(resolve(includeOf('{{编程 › 需求（改功能时）}}')!, [CODING])?.md).toBe(CODING.parts[0].md)
  expect(resolve(includeOf('{{编程 › 部署}}')!, [CODING])).toBeNull()
})

test('names not found; none while the shared rules are not here yet', () => {
  expect(notFound('{{编程X}}\n\n{{编程}}\n\n{{编程 › 部署}}', [CODING])).toEqual(['编程X', '编程 › 部署'])
  expect(notFound('{{编程X}}', null)).toEqual([])
})

test('a paragraph cut at its lines; one without any is drawn as it is', () => {
  expect(runsOf('## A\n\n- b')).toBeNull()
  expect(runsOf('{{编程}}\n本项目不用 Storybook')).toEqual([
    { kind: 'include', inc: includeOf('{{编程}}') },
    { kind: 'text', text: '本项目不用 Storybook' },
  ])
})

test('Insert puts the line on a line of its own where the caret is, the caret after it', () => {
  expect(insertLine('', 0, '{{编程}}')).toEqual({ text: '{{编程}}', caret: 6 })
  expect(insertLine('## Own\n\n- a', 0, '{{编程}}')).toEqual({ text: '{{编程}}\n\n## Own\n\n- a', caret: 6 })
  // inside a line: after that line
  const mid = insertLine('## Own\n\n- a', 3, '{{编程}}')
  expect(mid.text).toBe('## Own\n\n{{编程}}\n\n- a')
  expect(mid.text.slice(0, mid.caret)).toBe('## Own\n\n{{编程}}')
  expect(insertLine('- a', 3, '{{编程}}').text).toBe('- a\n\n{{编程}}')
})

test('ticked when the text puts it in already, however written; counted by project', () => {
  expect(hasLine('{{ 编程 > 测试 }}', '{{编程 › 测试}}')).toBe(true)
  expect(hasLine('{{编程}}', '{{编程 › 测试}}')).toBe(false)
  expect(usedCount(CODING)).toBe(2)
  expect(isSharedSlug('~q8rt2')).toBe(true)
  expect(isSharedSlug('taska')).toBe(false)
})
