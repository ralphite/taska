import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { toEndShown } from './scroller'
import { ToEnd } from './ToEnd'

// F716 r1171 (Yadong): a page with a talk above the box has a floating button to its end, as Codex has it: it does not
// show when the talk is at its end (within a few px), it shows when it is not, and a tap scrolls to the end.

/** a part 2000 high showing 600 (`high`: how high its content is), scrolled to `top`, with the talk in it */
const part = (top: number, high = 2000) => {
  const sc = document.createElement('div')
  sc.style.overflowY = 'auto'
  const talk = document.createElement('div')
  sc.append(talk)
  document.body.append(sc)
  let at = top
  Object.defineProperty(sc, 'scrollHeight', { value: high })
  Object.defineProperty(sc, 'clientHeight', { value: 600 })
  Object.defineProperty(sc, 'scrollTop', { get: () => at, set: (v: number) => (at = Math.min(v, high - 600)) })
  const scrollTo = vi.fn((o: ScrollToOptions) => (sc.scrollTop = o.top ?? 0))
  sc.scrollTo = scrollTo as unknown as typeof sc.scrollTo
  return { sc, talk, scrollTo }
}

describe('whether the button to the end shows (F716 r1171)', () => {
  test('at the end: no', () => expect(toEndShown(part(1400).sc)).toBe(false))
  test('a few px short of the end: still no', () => expect(toEndShown(part(1397).sc)).toBe(false))
  test('scrolled up: yes', () => expect(toEndShown(part(1000).sc)).toBe(true))
  test('a talk shorter than its part, nothing to scroll: no', () => expect(toEndShown(part(0, 500).sc)).toBe(false))
})

describe('the button to the end (F716 r1171)', () => {
  const button = () => screen.getByRole('button', { name: 'Scroll to bottom', hidden: true })
  test('at the end it does not show', () => {
    const { talk } = part(1400)
    render(<ToEnd of={talk} />)
    expect(button()).toHaveAttribute('data-to-end', 'hidden')
    expect(button()).toHaveClass('opacity-0')
  })
  test('scrolled up it shows; a tap scrolls smoothly to the end and it goes', () => {
    const { sc, talk, scrollTo } = part(1400)
    render(<ToEnd of={talk} />)
    act(() => {
      sc.scrollTop = 900
      fireEvent.scroll(sc)
    })
    expect(button()).toHaveAttribute('data-to-end', 'shown')
    act(() => {
      fireEvent.click(button())
      fireEvent.scroll(sc)
    })
    expect(scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' })
    expect(button()).toHaveAttribute('data-to-end', 'hidden')
  })
})
