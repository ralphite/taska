import { afterEach, describe, expect, test, vi } from 'vitest'
import { PageErrors } from './pageErrors'

// T582 #8154 (D136 C460): errors the page did not catch go to Taska's log, each once and at most 20 a page load, and
// the page asks the browser to keep its stored data.
describe('PageErrors', () => {
  let stop = () => {}
  afterEach(() => stop())

  function page() {
    const pageLog = vi.fn(async () => ({ ok: true }))
    const errors = new PageErrors({ api: { pageLog } as never, slug: () => 'shop' })
    stop = errors.stop
    return pageLog
  }

  const fail = (message: string) => window.dispatchEvent(new ErrorEvent('error', { message, error: new Error(message) }))

  test('an uncaught error and a rejected promise are logged as errors, each message once', () => {
    const pageLog = page()
    fail('x is undefined')
    fail('x is undefined')
    const rejected = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(rejected, 'reason', { value: new Error('fetch failed') })
    window.dispatchEvent(rejected)
    expect(pageLog.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['shop', 'shop'])
    const said = pageLog.mock.calls.map((c) => ((c as unknown[])[1] as { kind: string; level: string; msg: string }[])[0])
    expect(said.map((e) => [e.kind, e.level, e.msg])).toEqual([['error', 'error', 'x is undefined'], ['error', 'error', 'fetch failed']])
  })

  test('at most 20 a page load', () => {
    const pageLog = page()
    for (let i = 0; i < 30; i++) fail(`error ${i}`)
    expect(pageLog).toHaveBeenCalledTimes(20)
  })

  test('it asks the browser to keep the stored data', () => {
    const persist = vi.fn(async () => true)
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true })
    page()
    expect(persist).toHaveBeenCalled()
  })
})
