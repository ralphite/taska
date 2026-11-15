import { afterEach, describe, expect, test, vi } from 'vitest'
import { Http } from '../../api/http'
import { createRouteStore, type History } from '../../stores/route'
import { keyOf, PageActions } from './pageActions'

const history = (): History => ({
  location: () => ({ path: '/p/shop/B1', search: '', hash: '' }),
  push: () => {},
  replace: () => {},
  state: () => null,
  back: () => {},
  backBy: () => {},
  listen: () => () => {},
})

describe('PageActions (B791: what you do on the page is logged)', () => {
  let stop = () => {}
  afterEach(() => {
    stop()
    document.body.innerHTML = ''
  })

  function page(answer: () => Promise<Response>) {
    const sent: Record<string, unknown>[][] = []
    const http = new Http(answer)
    const api = { http, pageLog: vi.fn(async (_slug: string, list: Record<string, unknown>[]) => (sent.push(list), { ok: true })) }
    const log = new PageActions({ api: api as never, slug: () => 'shop', route: createRouteStore(history()) })
    stop = log.stop
    return { log, sent, http }
  }

  test('a control tapped is logged by its name; what is typed is not', () => {
    const { log, sent } = page(async () => new Response('{}'))
    const send = document.createElement('button')
    send.setAttribute('aria-label', 'Send')
    send.textContent = '→'
    const box = document.createElement('textarea')
    const words = document.createElement('p')
    words.textContent = 'just words'
    document.body.append(send, box, words)
    send.click()
    words.click()
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }))
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    log.send(false)
    expect(sent[0].map((e) => [e.kind, e.what ?? ''])).toEqual([['open', ''], ['tap', 'Send'], ['key', 'Enter']])
  })

  test("a refused request is logged with the server's reason, a quick one that worked is not", async () => {
    let n = 0
    const { log, sent, http } = page(async () => (n++ ? new Response('{"ok": false, "results": ["err B9: no such item"]}', { status: 400 }) : new Response('{}')))
    await http.json('/p/shop/api/view')
    await http.json('/p/shop/api/commands?cursor=1', { method: 'POST', body: {} }).catch(() => {})
    log.send(false)
    const net = sent[0].filter((e) => e.kind === 'net')
    expect(net).toEqual([expect.objectContaining({ why: 'failed', method: 'POST', url: '/p/shop/api/commands?cursor=1', status: 400, msg: 'no such item' })])
  })

  test('the keys that act are told apart from typing', () => {
    const k = (key: string, more: Partial<KeyboardEventInit> = {}) => new KeyboardEvent('keydown', { key, ...more })
    expect(keyOf(k('a'), true)).toBe('')
    expect(keyOf(k('a'), false)).toBe('a')
    expect(keyOf(k('k', { metaKey: true }), true)).toBe('⌘k')
    expect(keyOf(k('Escape'), true)).toBe('Escape')
    expect(keyOf(k('Shift'), false)).toBe('')
  })
})
