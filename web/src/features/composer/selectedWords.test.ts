// Which selected words the bar over them is for (B708 r1149: the page's bar and a document's stories read the
// selection through this one function).
import { afterEach, describe, expect, it } from 'vitest'
import { selected } from './selectedWords'

function page(html: string) {
  document.body.innerHTML = html
}

/** Selects `words` in the first element matching `css`, as a drag over them would. */
function select(css: string, words: string) {
  const el = document.body.querySelector(css)
  const t = el?.firstChild as Text
  const i = t.data.indexOf(words)
  const r = document.createRange()
  r.setStart(t, i)
  r.setEnd(t, i + words.length)
  getSelection()?.removeAllRanges()
  getSelection()?.addRange(r)
}

const DOC = `<div data-doc-blocks="7"><section data-key="p1"><p data-block>The new page is written from scratch</p><div data-thread><p class="c">Looks right to me</p></div></section></div>`

afterEach(() => {
  getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
})

describe('selected words (B708 r1149)', () => {
  it("are a document's passage: its paragraph and the words", () => {
    page(DOC)
    select('[data-block]', 'written from scratch')
    const s = selected(7, false)
    expect(s && { d: s.d, key: s.key, text: s.text }).toEqual({ d: 7, key: 'p1', text: 'written from scratch' })
  })

  it("are none in a comment's words, in another document, while circling, or under two letters", () => {
    page(DOC)
    select('.c', 'right')
    expect(selected(7, false)).toBeNull()
    select('[data-block]', 'written')
    expect(selected(8, false)).toBeNull()
    expect(selected(7, true)).toBeNull()
    select('[data-block]', 'T')
    expect(selected(7, false)).toBeNull()
  })

  it('outside a document, are words where voice comments go, not the box', () => {
    page(`<div data-vc-area><p class="a">Move the filter to the sidebar</p></div><div id="composer"><p class="b">typed words here</p></div>`)
    select('.a', 'the filter')
    expect(selected(null, false)).toMatchObject({ d: null, key: null, text: 'the filter' })
    select('.b', 'typed words')
    expect(selected(null, false)).toBeNull()
  })
})
