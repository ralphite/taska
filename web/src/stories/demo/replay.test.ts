import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dues, replay, type Exchange, type Recording } from './replay'

const POLL = '/p/shop/api/changes?cursor=c1&wait=25'
// the page loads, waits for news; you send what you said (a voice note, then the input); the organizer files it 1.5 s
// after the input came, which answers the wait
const xs: Exchange[] = [
  { method: 'GET', url: '/p/shop/api/view', status: 200, json: { cursor: 'c1', items: [] }, sent: 0, at: 20 },
  { method: 'GET', url: POLL, status: 200, json: { cursor: 'c1', same: true, server: { page: 'x', update: false } }, sent: 30, at: 25030 },
  { method: 'POST', url: '/p/shop/api/file?name=voice+0-03.webm', status: 200, json: { ok: true, f: 'f8' }, sent: 26000, at: 26100 },
  { method: 'POST', url: '/p/shop/api/commands?cursor=c1', status: 200, json: { ok: true }, sent: 26200, at: 26300 },
  { method: 'GET', url: POLL, status: 200, json: { cursor: 'c2', items: [{ n: 44 }] }, sent: 25040, at: 27700 },
]
const rec: Recording = { demo: 'sayIt', layout: 'phone', made: '', exchanges: xs }

describe('a Demo answers as the server did', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const net = () => replay(rec, Response, () => Date.now(), setTimeout)
  const body = async (r: Promise<Response>) => (await r).json()

  it('says when each answer may go: news after the changes that brought it, as long after as it took', () => {
    expect(dues(xs).map((d) => d.after)).toEqual([0, 0, 0, 1, 2])
    expect(dues(xs)[4].delay).toBe(1500)
  })

  it('holds the wait for news like the server: nothing new after 25 s, never an error (the page stays online)', async () => {
    const { transport } = net()
    let done = false
    const r = transport(POLL, { method: 'GET' }).then((x) => ((done = true), x))
    await vi.advanceTimersByTimeAsync(24000)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await body(r)).toMatchObject({ cursor: 'c1', same: true, server: { page: 'x' } })
  })

  it('answers the wait with the news only once what brought it was sent, as long after as the server took', async () => {
    const { transport, log } = net()
    const view = transport('/p/shop/api/view', { method: 'GET' })
    await vi.advanceTimersByTimeAsync(100)
    expect(await body(view)).toMatchObject({ cursor: 'c1' })
    let news: unknown = null
    void transport(POLL, { method: 'GET' }).then(async (r) => (news = await r.json()))
    await vi.advanceTimersByTimeAsync(5000)
    expect(news).toBe(null)
    const file = transport('/p/shop/api/file?name=voice+0-04.webm', { method: 'POST' })
    await vi.advanceTimersByTimeAsync(200)
    expect(await body(file)).toMatchObject({ f: 'f8' })
    void transport('/p/shop/api/commands?cursor=c1', { method: 'POST' })
    await vi.advanceTimersByTimeAsync(1400)
    expect(news).toBe(null)
    await vi.advanceTimersByTimeAsync(200)
    expect(news).toMatchObject({ cursor: 'c2' })
    expect(log.unmatched).toEqual([])
  })

  it('off the route: a change is never answered and is noted; the page letting go ends the wait', async () => {
    const { transport, log } = net()
    const ctl = new AbortController()
    const r = transport('/p/shop/api/rename', { method: 'POST', signal: ctl.signal })
    ctl.abort()
    await expect(r).rejects.toThrow('let go')
    expect(log.unmatched).toEqual(['POST /p/shop/api/rename'])
  })
})
