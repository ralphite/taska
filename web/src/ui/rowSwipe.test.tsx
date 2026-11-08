import { act, fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useRowSwipe, type RowSwipe } from './rowSwipe'

// T589 #10486: a row swiped open closes when the rows are drawn anew, when one of its buttons is tapped and when another
// row is swiped; it stays open while the page draws the same rows again.
const opts: RowSwipe = { right: () => null, blocked: () => false }

function List({ drawing, onLater = () => {} }: { drawing: string; onLater?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useRowSwipe(ref, true, opts, drawing)
  return (
    <div ref={ref}>
      {['1', '2'].map((k) => (
        <article key={k} data-testid={`row${k}`}>
          <div>
            <div data-swipe-left hidden />
            <div data-swipe-right hidden>
              <button onClick={onLater}>Later {k}</button>
            </div>
            <div data-swipe={k}>Row {k}</div>
          </div>
        </article>
      ))}
    </div>
  )
}

const touch = (el: Element, type: string, x: number) => {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: 10 }] })
  el.dispatchEvent(e)
}
/** a finger swipes row `k` left: it stays open, its ways back under it */
const swipeLeft = (root: HTMLElement, k: string) => {
  const row = root.querySelector(`[data-swipe="${k}"]`) as HTMLElement
  touch(row, 'touchstart', 200)
  touch(row, 'touchmove', 150)
  touch(row, 'touchmove', 120)
  touch(row, 'touchend', 120)
  return row
}
const isOpen = (row: HTMLElement) => !!row.style.transform && !(row.parentElement?.querySelector('[data-swipe-right]') as HTMLElement).hidden
const isClosed = (row: HTMLElement) => !row.style.transform && (row.parentElement?.querySelector('[data-swipe-right]') as HTMLElement).hidden

// jsdom lays nothing out: a row is 393 wide, its ways back 76
const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-swipe-right') ? 76 : 393
    },
  })
})
afterEach(() => {
  vi.useRealTimers()
  if (width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', width)
})

describe('a row swiped open (T589 #10486)', () => {
  test('closes when the rows are drawn anew (Done, Later, Won’t do, a subitem done)', () => {
    const { container, rerender } = render(<List drawing="a" />)
    const row = swipeLeft(container, '1')
    expect(isOpen(row)).toBe(true)
    rerender(<List drawing="b" />)
    act(() => void vi.advanceTimersByTime(300))
    expect(isClosed(row)).toBe(true)
  })

  test('stays open while the page draws the same rows again', () => {
    const { container, rerender } = render(<List drawing="a" />)
    const row = swipeLeft(container, '1')
    rerender(<List drawing="a" />)
    act(() => void vi.advanceTimersByTime(300))
    expect(isOpen(row)).toBe(true)
  })

  test('one of its buttons does what it says and closes it', () => {
    const later = vi.fn()
    const { container, getByText } = render(<List drawing="a" onLater={later} />)
    act(() => void vi.advanceTimersByTime(500)) // past the swipe's own swallowed tap
    const row = swipeLeft(container, '1')
    act(() => void vi.advanceTimersByTime(500))
    fireEvent.click(getByText('Later 1'))
    expect(later).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(300))
    expect(isClosed(row)).toBe(true)
  })

  test('closes when another row is swiped', () => {
    const { container } = render(<List drawing="a" />)
    const one = swipeLeft(container, '1')
    const two = swipeLeft(container, '2')
    act(() => void vi.advanceTimersByTime(300))
    expect(isClosed(one)).toBe(true)
    expect(isOpen(two)).toBe(true)
  })
})
