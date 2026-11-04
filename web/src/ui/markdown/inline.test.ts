import { describe, expect, test } from 'vitest'
import { inlineHtml, type InlineWorld } from './inline'

const world: InlineWorld = { find: (c) => (c === 'D1' ? { kind: 'doc', d: 1 } : null), url: (f) => f, size: () => undefined }

describe('links', () => {
  test('a link to a Taska code shows its words and opens what the code names', () => {
    for (const md of ['see [the plan](#D1)', 'see [the plan](D1)']) {
      const html = inlineHtml(md, world)
      expect(html).toContain('data-ref="D1"')
      expect(html).toContain('>the plan</span>')
      expect(html).not.toContain('](')
    }
  })
  test('a link to a code that names nothing is just its words', () => {
    expect(inlineHtml('see [the plan](#D9)', world)).toBe('see the plan')
  })
})

describe('pictures', () => {
  test('a picture without words is named by its file, so its button has a name', () => {
    expect(inlineHtml('![](shots/after.png)', world)).toContain('alt="after.png"')
    expect(inlineHtml('![the list](shots/after.png)', world)).toContain('alt="the list"')
  })
})
