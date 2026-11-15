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

// B714 (D136 C215, C216): the help page explains, in plain words, how what you say becomes items: its steps, what
// the organizer does, where you see what (the flow of D126, as steps and a table: the help page draws no pictures).
describe('what happens to what you say', () => {
  it('keeps its steps, what the organizer does and where you see what', () => {
    const [found] = searchHelp('What happens to what you say')
    expect(found.topic.title).toBe('What happens to what you say')
    for (const part of ['## Step by step', '## What the organizer does', '## Where you see what', '| You say | Your inputs show | Where else |'])
      expect(found.topic.text).toContain(part)
  })
})
