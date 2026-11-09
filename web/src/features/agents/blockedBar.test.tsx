import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { BlockedBar } from './BlockedBar'

// T711: the blocked bar names the agent by its app's icon, says Blocked and nothing about what it waits on; Open opens
// the Agents sheet. Its live region is there before it shows, so a screen reader hears it come.
test('blocked: the icon, Blocked, Open; none blocked: the live region alone', () => {
  const onOpen = vi.fn()
  const { container, rerender } = render(<BlockedBar by={null} place="" onOpen={onOpen} />)
  const live = screen.getByRole('status')
  expect(live.getAttribute('aria-live')).toBe('polite')
  expect(live.textContent).toBe('')
  rerender(<BlockedBar by="claude-code" place="" onOpen={onOpen} />)
  expect(screen.getByRole('img', { name: 'Claude Code' })).toBeTruthy()
  expect(live.textContent).toBe('BlockedOpen')
  fireEvent.click(screen.getByRole('button', { name: 'Open Agents' }))
  expect(onOpen).toHaveBeenCalledOnce()
  expect(container.textContent).not.toMatch(/Claude Code|approve/)
})
