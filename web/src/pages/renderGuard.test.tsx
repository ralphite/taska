// T859 (Yadong r1461): a page that throws while drawing shows a line and Reload, never a blank window; the error goes
// to the page's log, and the page is drawn again once what it draws changes (the server's copy came).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RenderGuard } from './RenderGuard'

function Page({ ok }: { ok: boolean }) {
  if (!ok) throw new TypeError('n.tags is not iterable')
  return <p>Tasks</p>
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('RenderGuard', () => {
  it('shows a line and Reload when drawing throws, tells the log, and draws again when what it draws changes', () => {
    const told = vi.fn()
    const reload = vi.fn()
    vi.stubGlobal('reportError', told)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <RenderGuard again={1} reload={reload}>
        <Page ok={false} />
      </RenderGuard>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t show this page.')
    screen.getByRole('button', { name: 'Reload' }).click()
    expect(reload).toHaveBeenCalledOnce()
    expect(told).toHaveBeenCalledWith(expect.objectContaining({ message: 'n.tags is not iterable' }))
    rerender(
      <RenderGuard again={1} reload={reload}>
        <Page ok />
      </RenderGuard>,
    )
    expect(screen.queryByText('Tasks')).toBeNull() // the same copy: not drawn again
    rerender(
      <RenderGuard again={2} reload={reload}>
        <Page ok />
      </RenderGuard>,
    )
    expect(screen.getByText('Tasks')).toBeTruthy()
  })
})
