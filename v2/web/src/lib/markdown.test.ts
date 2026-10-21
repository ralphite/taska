import { describe, expect, it } from 'vitest'
import { hasChoices, richHtml, tickedBlock } from './markdown'
import { item, load } from '../test/fixture'

describe('text the same way everywhere', () => {
  it('escapes what was typed: no script or handler gets through', () => {
    load([])
    const html = richHtml('<img src=x onerror=alert(1)> **bold** <script>alert(2)</script>')
    const div = document.createElement('div')
    div.innerHTML = html
    expect(div.querySelector('img, script, [onerror]')).toBe(null)
    expect(div.querySelector('strong')?.textContent).toBe('bold')
    expect(div.textContent).toContain('<img src=x onerror=alert(1)>') // shown as the words typed
  })
  it('choices in the open question are buttons for that item only', () => {
    load([item(7)])
    const text = 'Which way?\n- ( ) Left\n- ( ) Right'
    expect(hasChoices(text)).toBe(true)
    const div = document.createElement('div')
    div.innerHTML = richHtml(text, '', '', 7)
    const b = div.querySelectorAll('button[data-act="choice"]')
    expect(b.length).toBe(2)
    expect(b[0].getAttribute('data-n')).toBe('7')
    div.innerHTML = richHtml(text)
    expect(div.querySelectorAll('button[data-act="choice"]').length).toBe(0)
  })
  it('an item code is a link to it with its card, an unknown code stays text', () => {
    load([item(3, { type: 'bug' })])
    const div = document.createElement('div')
    div.innerHTML = richHtml('See B3 and B9')
    const refs = div.querySelectorAll('[data-act="goto"]')
    expect(refs.length).toBe(1)
    expect(refs[0].getAttribute('data-ref')).toBe('B3')
  })
})

describe('choices in a document (F393, B412, B420)', () => {
  it('ticks one choice; one of "( )" at a time; "All" ticks and unticks the whole list', () => {
    expect(tickedBlock('- [ ] Red\n- [ ] Blue', 1)).toBe('- [ ] Red\n- [x] Blue')
    expect(tickedBlock('- (x) Send\n- ( ) OK', 1)).toBe('- ( ) Send\n- (x) OK')
    const all = tickedBlock('- [ ] 全部\n- [ ] Red\n- [ ] Blue', 0) as string
    expect(all).toBe('- [x] 全部\n- [x] Red\n- [x] Blue')
    expect(tickedBlock(all, 0)).toBe('- [ ] 全部\n- [ ] Red\n- [ ] Blue')
  })
})

describe('two lists of choices in one paragraph (D32)', () => {
  it('a "( )" choice clears only its own list', () => {
    const b = '- (x) Ours\n- ( ) Library\nConflicts:\n- ( ) Agree\n- ( ) Disagree'
    expect(tickedBlock(b, 2)).toBe('- (x) Ours\n- ( ) Library\nConflicts:\n- (x) Agree\n- ( ) Disagree')
  })
})
