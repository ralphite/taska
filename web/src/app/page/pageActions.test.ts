import { afterEach, describe, expect, test, vi } from 'vitest'
import { Http } from '../../api/http'
import { createOutboxStore } from '../../stores/outbox'
import { createRouteStore, type History } from '../../stores/route'
import { memoryStore } from '../../stores/storage'
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
    const outbox = createOutboxStore(memoryStore())
    const log = new PageActions({ api: api as never, slug: () => 'shop', route: createRouteStore(history()), outbox })
    stop = log.stop
    return { log, sent, http, outbox }
  }

  test('a control tapped is logged by its name; what is typed is not', () => {
    const { log, sent } = page(async () => new Response('{}'))
    const send = document.createElement('button')
    send.setAttribute('aria-label', 'Send')
    send.textContent = '→'
    const box = document.createElement('textarea')
    const words = document.createElement('p')
    words.textContent = 'just words'
    const row = document.createElement('article')
    row.setAttribute('data-n', '12')
    row.innerHTML = '<div data-swipe-left>Done Later</div><div data-swipe="12">B12 <b>Fix the login</b></div>'
    const settings = document.createElement('button')
    settings.innerHTML = 'Settings <kbd>G</kbd> <kbd>S</kbd>'
    document.body.append(send, box, words, row, settings)
    send.click()
    words.click()
    row.querySelector('b')!.click()
    settings.click()
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }))
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    log.send(false)
    expect(sent[0].map((e) => [e.kind, e.what ?? ''])).toEqual([['open', ''], ['tap', 'Send'], ['tap', 'B12 Fix the login'], ['tap', 'Settings'], ['key', 'Enter']])
  })

  test("a refused request is logged with the server's reason, a slow one too; a quick one and the wait for news are not", async () => {
    let n = 0
    const { log, sent, http } = page(async () => (n++ === 1 ? new Response('{"ok": false, "results": ["err B9: no such item"]}', { status: 400 }) : new Response('{}')))
    await http.json('/p/shop/api/view')
    await http.json('/p/shop/api/commands?cursor=1', { method: 'POST', body: {} }).catch(() => {})
    // the long wait for news is slow on purpose; another slow request is noted
    http.watch?.({ method: 'GET', url: '/p/shop/api/changes?cursor=1&wait=25', ms: 25010, ok: true, status: 200 })
    http.watch?.({ method: 'GET', url: '/p/shop/api/doc?d=6', ms: 5000, ok: true, status: 200 })
    log.send(false)
    const net = sent[0].filter((e) => e.kind === 'net')
    expect(net).toEqual([
      expect.objectContaining({ why: 'failed', method: 'POST', url: '/p/shop/api/commands?cursor=1', status: 400, msg: 'no such item' }),
      expect.objectContaining({ why: 'slow', url: '/p/shop/api/doc?d=6', ms: 5000 }),
    ])
  })

  test('what you send is logged by where it went and how long it is, never its words; a send that failed too', () => {
    const { log, sent, outbox } = page(async () => new Response('{}'))
    const o = { q: 'q1', slug: 'shop', text: 'my secret words', scope: 'B12', files: [{ f: 'f1-voice.webm', name: 'voice.webm', mime: 'audio/webm', size: 9 }], t: 1, state: 'waiting' as const, tries: 0 }
    outbox.getState().push(o)
    outbox.getState().update('q1', { state: 'failed', net: true, tries: 1 })
    log.send(false)
    const rows = sent[0].filter((e) => e.kind !== 'open')
    expect(rows).toEqual([expect.objectContaining({ kind: 'send', to: 'B12', chars: 15, files: 1, voice: 1 }), expect.objectContaining({ kind: 'send-failed', to: 'B12', net: true, tries: 1 })])
    expect(JSON.stringify(sent)).not.toContain('secret')
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
