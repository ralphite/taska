import { describe, expect, it } from 'vitest'
import { ACTIONS, actionOfKeys, helpedActions, keyHelp, keysShown, paletteRows, type ActionId } from './actions'

// the actions whose keys the keys sheet tells in words of its own ("G then I N A R", "O or ↵", "Space", "Esc", "1–9, ⌘↵",
// "E / ⇧E")
const TOLD_IN_WORDS: ActionId[] = ['archive', 'full', 'scroll', 'send-answer', 'items', 'inputs', 'archive-tab', 'rules', 'switch-project', 'settings', 'back']

describe('the table of actions', () => {
  const ids = Object.keys(ACTIONS) as ActionId[]

  it('gives each key to one action', () => {
    const keys = ids.map((id) => ACTIONS[id].keys).filter(Boolean)
    expect(new Set(keys).size).toBe(keys.length)
    for (const id of ids) if (ACTIONS[id].keys) expect(actionOfKeys(ACTIONS[id].keys!)).toBe(id)
  })

  it('has every key told on the keys sheet', () => {
    const helped = new Set(helpedActions())
    for (const id of ids) if (ACTIONS[id].keys) expect(helped.has(id) || TOLD_IN_WORDS.includes(id), id).toBe(true)
  })

  it('writes the keys as the sheet always has', () => {
    const keys = Object.fromEntries(keyHelp().flatMap(([, r]) => r.map(([k, t]) => [t, k])))
    expect(keys["The item's next step: Accept, Approve, Answer or Reply"]).toBe('A')
    expect(keys['Archive or unarchive / archive every finished item']).toBe('E / ⇧E')
    expect(keys["Done · Won't do · Later / Now"]).toBe('D · W · L')
    expect(keys['Edit · New doc · Add subitem']).toBe('I · ⇧D · ⇧A')
    expect(keys['Next or previous item']).toBe('J / K')
    expect(keys['Go to an item or do anything here']).toBe('⌘K')
    expect(keysShown('palette')).toBe('⌘K')
    expect(keysShown('copy')).toBe('⇧C')
  })

  it('lists the palette in its order', () => {
    expect(paletteRows(true).map((r) => r.keys)).toEqual(['a', 'r', 'n', 'd', 'l', 'e', 'w', 'i', 's', 'p', 't', 'm', 'A', 'D', 'C', 'o'])
    expect(paletteRows(false).map((r) => r.keys)).toEqual(['c', '/', 'f', 'V', 'g i', 'g n', 'g a', 'g r', 'g p', 'g s', '[', 'z', '?'])
  })
})
