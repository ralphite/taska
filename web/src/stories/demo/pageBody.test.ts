// T589 r1161: a Demo frame's body has the page's classes; they must stay what web/index.html says.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PAGE_BODY } from './pageBody'

test("the Demo frame's body classes are the page's", () => {
  const html = readFileSync(join(__dirname, '..', '..', '..', 'index.html'), 'utf8')
  expect(/<body class="([^"]*)"/.exec(html)?.[1]).toBe(PAGE_BODY)
})
