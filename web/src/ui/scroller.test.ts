import { describe, expect, test } from 'vitest'
import { holdHeight, keepsEnd, scrollerOf, toEnd } from './scroller'

// T589 #10486: the talk opens at its latest message and goes to its end after you send in one way on both layouts:
// on the desktop the talk scrolls itself, on the phone the page round it does.
const page = (talkScrolls: boolean) => {
  const body = document.createElement('div')
  body.style.overflowY = 'auto'
  const item = document.createElement('div')
  const talk = document.createElement('div')
  if (talkScrolls) talk.style.overflowY = 'auto'
  item.append(talk)
  body.append(item)
  document.body.append(body)
  for (const el of [body, talk]) Object.defineProperty(el, 'scrollHeight', { value: 2000 })
  return { body, talk }
}

describe('what scrolls the talk (T589 #10486)', () => {
  test('the desktop: the talk itself', () => {
    const { talk } = page(true)
    expect(scrollerOf(talk)).toBe(talk)
  })
  test('the phone: the page round it, scrolled to its end', () => {
    const { body, talk } = page(false)
    expect(scrollerOf(talk)).toBe(body)
    toEnd(talk)
    expect(body.scrollTop).toBe(2000)
  })
})

describe('the talk keeps to its end (T589 #10486)', () => {
  /** a part 2000 high showing 600, scrolled to `top` */
  const at = (top: number) => {
    const sc = document.createElement('div')
    Object.defineProperty(sc, 'scrollHeight', { value: 2000 })
    Object.defineProperty(sc, 'clientHeight', { value: 600 })
    Object.defineProperty(sc, 'scrollTop', { value: top })
    return sc
  }
  test('at its end it keeps to it', () => expect(keepsEnd(at(1400), 1000, false)).toBe(true))
  test('the page’s own scroll to the end, landing after a reply grew the talk: still kept to its end', () => expect(keepsEnd(at(1300), 1000, true)).toBe(true))
  test('scrolled up by you: it lets go', () => expect(keepsEnd(at(900), 1000, true)).toBe(false))
  test('let go, scrolled down short of the end: still let go', () => expect(keepsEnd(at(1300), 1000, false)).toBe(false))
})

describe('at its end the talk never gets shorter under you (B770 r1292)', () => {
  /** the talk's messages, `h` high as drawn (and no less than a height kept for them) */
  const body = (h: number) => {
    const el = document.createElement('div')
    const drawn = { h }
    Object.defineProperty(el, 'offsetHeight', { get: () => Math.max(drawn.h, parseFloat(el.style.minHeight) || 0) })
    return { el, set: (n: number) => (drawn.h = n) }
  }
  test('its last message a line shorter at its end: its height is kept', () => {
    const b = body(975)
    expect(holdHeight(b.el, 1000, true)).toBe(1000)
    expect(b.el.offsetHeight).toBe(1000)
  })
  test('taller again: nothing is kept', () => {
    const b = body(975)
    holdHeight(b.el, 1000, true)
    b.set(1040)
    expect(holdHeight(b.el, 1000, true)).toBe(1040)
    expect(b.el.style.minHeight).toBe('')
  })
  test('scrolled away from its end: what was kept goes, and shorter is shorter', () => {
    const b = body(975)
    holdHeight(b.el, 1000, true)
    expect(holdHeight(b.el, 1000, false)).toBe(975)
    b.set(900)
    expect(holdHeight(b.el, 975, false)).toBe(900)
  })
})
