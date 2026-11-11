import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { toEndWay } from './scroller'
import { ToEnd } from './ToEnd'

// F716 r1171 (Yadong): a page with a talk above the box has a floating button to its end, as Codex has it: it points
// down while the talk is not at its end, and a tap scrolls to the end. F752 r1250 (Yadong): at the end it does not go
// away: its arrow points up, and a tap goes back to the top. With nothing to scroll it does not show.

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
  Object.defineProperty(sc, 'scrollTop', { get: () => at, set: (v: number) => (at = Math.max(0, Math.min(v, high - 600))) })
  const scrollTo = vi.fn((o: ScrollToOptions) => (sc.scrollTop = o.top ?? 0))
  sc.scrollTo = scrollTo as unknown as typeof sc.scrollTo
  return { sc, talk, scrollTo }
}

describe('which way the button to the end points (F716 r1171, F752 r1250)', () => {
  test('at the end: up', () => expect(toEndWay(part(1400).sc)).toBe('up'))
  test('a few px short of the end: still up', () => expect(toEndWay(part(1397).sc)).toBe('up'))
  test('scrolled up: down', () => expect(toEndWay(part(1000).sc)).toBe('down'))
  test('a talk shorter than its part, nothing to scroll: none', () => expect(toEndWay(part(0, 500).sc)).toBe('none'))
})

describe('the button to the end (F716 r1171, F752 r1250)', () => {
  const button = () => screen.getByRole('button', { hidden: true })
  test('at the end it shows Back to top; a tap scrolls smoothly to the top, and there it points down again', () => {
    const { sc, talk, scrollTo } = part(1400)
    render(<ToEnd of={talk} />)
    expect(button()).toHaveAttribute('data-to-end', 'up')
    expect(button()).toHaveAccessibleName('Back to top')
    act(() => {
      fireEvent.click(button())
      fireEvent.scroll(sc)
    })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(button()).toHaveAttribute('data-to-end', 'down')
  })
  test('scrolled up it points down; a tap scrolls smoothly to the end, and there it points up', () => {
    const { sc, talk, scrollTo } = part(1400)
    render(<ToEnd of={talk} />)
    act(() => {
      sc.scrollTop = 900
      fireEvent.scroll(sc)
    })
    expect(button()).toHaveAttribute('data-to-end', 'down')
    expect(button()).toHaveAccessibleName('Scroll to bottom')
    act(() => {
      fireEvent.click(button())
      fireEvent.scroll(sc)
    })
    expect(scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' })
    expect(button()).toHaveAttribute('data-to-end', 'up')
  })
  test('with nothing to scroll it does not show', () => {
    const { talk } = part(0, 500)
    render(<ToEnd of={talk} />)
    expect(button()).toHaveAttribute('data-to-end', 'hidden')
    expect(button()).toHaveClass('opacity-0')
  })
})
