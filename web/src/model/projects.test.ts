import { describe, expect, test } from 'vitest'
import { newSlug } from './projects'

describe("a new project's address, as the server makes it (D115 #7: its tile's colour)", () => {
  test('from its name; -2 while taken; none from a name with no a-z or 0-9', () => {
    expect(newSlug('Home Budget', [])).toBe('home-budget')
    expect(newSlug('Café  Plans!', [])).toBe('cafe-plans')
    expect(newSlug('Shop', ['shop', 'shop-2'])).toBe('shop-3')
    expect(newSlug('读书笔记', [])).toBe('')
  })
})
