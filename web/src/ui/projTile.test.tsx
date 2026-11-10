import { fireEvent, render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { iconUrl } from '../model/projects'
import { ProjTile } from './bits'

// F743: a project with a picture (an agent set it: `project icon f12-logo.png`) is drawn by it wherever its tile is;
// without one, or when the picture does not load, its letter on its colour, as before.
describe("a project's tile", () => {
  test('its letter when it has no picture', () => {
    const { container } = render(<ProjTile title="taska" tone="bg-blue-600" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('t')
  })

  test('its picture when it has one, and its letter again when the picture does not load', () => {
    const { container } = render(<ProjTile title="taska" tone="bg-blue-600" icon="/p/taska/f/f12-logo.png" />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/p/taska/f/f12-logo.png')
    expect(container.textContent).toBe('')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('t')
  })

  test("the picture's address is the project's file; none without one", () => {
    expect(iconUrl('taska', 'f12-logo.png')).toBe('/p/taska/f/f12-logo.png')
    expect(iconUrl('taska', '')).toBeUndefined()
    expect(iconUrl('taska', undefined)).toBeUndefined()
  })
})
