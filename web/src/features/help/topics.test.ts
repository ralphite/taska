import { describe, expect, it } from 'vitest'
import { searchHelp } from './topics'

describe('searchHelp', () => {
  it('finds a topic by its name first, with no line of its words', () => {
    const [first] = searchHelp('voice')
    expect(first.topic.title.toLowerCase() + first.topic.about.toLowerCase()).toContain('voice')
    expect(first.line).toBeNull()
  })

  it('shows the plain sentence that matched for a topic found by its words only', () => {
    const byWords = searchHelp('phone').filter((f) => f.line !== null)
    expect(byWords.length).toBeGreaterThan(0)
    for (const { line } of byWords) {
      expect(line!.toLowerCase()).toContain('phone')
      expect(line).not.toMatch(/\*\*|`|^#|^- /)
    }
  })
})
