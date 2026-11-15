import { afterEach, expect, test, vi } from 'vitest'
import { browserStore } from '../../stores/storage'
import { PageErrors } from './pageErrors'

// T806 #3 (r1376): a write this browser's storage refuses (full, or cleared) goes to Taska's log, once
let stop = () => {}
afterEach(() => {
  stop()
  vi.restoreAllMocks()
})

test('a refused write is logged once, with the key it was for', () => {
  const pageLog = vi.fn(async () => ({ ok: true }))
  const kv = browserStore()
  const errors = new PageErrors({ api: { pageLog } as never, slug: () => 'shop', stores: [kv] })
  stop = errors.stop
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('the quota has been exceeded', 'QuotaExceededError')
  })
  kv.setJson('taska.outbox.shop', [{ q: 'q1' }])
  kv.setJson('taska.outbox.shop', [{ q: 'q1' }, { q: 'q2' }])
  expect(pageLog).toHaveBeenCalledTimes(1)
  const [slug, list] = pageLog.mock.calls[0] as unknown as [string, { kind: string; level: string; msg: string }[]]
  expect([slug, list[0].kind, list[0].level]).toEqual(['shop', 'storage', 'warn'])
  expect(list[0].msg).toContain('taska.outbox.shop')
  expect(list[0].msg).toContain('QuotaExceededError')
})
