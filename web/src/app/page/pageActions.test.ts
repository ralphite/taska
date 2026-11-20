import { afterEach, describe, expect, test, vi } from 'vitest'
import { Http } from '../../api/http'
import { createOutboxStore } from '../../stores/outbox'
import { createRouteStore, type History } from '../../stores/route'
import { createSheetStore } from '../../stores/sheet'
import { SWIPED } from '../../ui/rowSwipe'
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
    const sheet = createSheetStore()
    const log = new PageActions({ api: api as never, slug: () => 'shop', route: createRouteStore(history()), outbox, sheet })
    stop = log.stop
    return { log, sent, http, outbox, sheet }
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

  test('a sheet or menu that opens is logged, once, by its kind (B842: taps on Type could not be told from taps on nothing)', () => {
    const { log, sent, sheet } = page(async () => new Response('{}'))
    sheet.getState().open({ req: { kind: 'item-menu', n: 10, arm: 't' } } as never)
    sheet.getState().setArm('t')
    sheet.getState().close()
    log.send(false)
    expect(sent[0].filter((e) => e.kind === 'sheet')).toEqual([expect.objectContaining({ kind: 'sheet', what: 'item-menu', arm: 't' })])
  })

  test('a swipe on a row is logged with the way it went and what it did (F846: swipes were not in the log)', () => {
    const { log, sent } = page(async () => new Response('{}'))
    document.body.innerHTML = `<article data-n="12"><div data-swipe-left hidden>Done</div><div data-swipe-right hidden><button>Later</button><button>Won't do</button></div><div data-swipe="12">Fix the export</div></article>`
    const row = document.body.getElementsByTagName('article')[0].lastElementChild as HTMLElement
    const swipe = (dir: string, did: boolean) => row.dispatchEvent(new CustomEvent(SWIPED, { bubbles: true, detail: { dir, did } }))
    swipe('right', true)
    swipe('left', true)
    swipe('right', false)
    document.body.getElementsByTagName('button')[0].click()
    log.send(false)
    const rows = sent[0].filter((e) => e.kind === 'swipe' || e.kind === 'tap')
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'swipe', dir: 'right', what: 'Done', n: '12' }),
      expect.objectContaining({ kind: 'swipe', dir: 'left', what: "Later Won't do", n: '12' }),
      expect.objectContaining({ kind: 'swipe', dir: 'right', what: 'nothing' }),
      expect.objectContaining({ kind: 'tap', what: 'Later', from: 'swipe' }),
    ])
    document.body.innerHTML = ''
  })

  test('every other action is logged by what it was done to, never its words (F846 r1451)', () => {
    const { log, sent } = page(async () => new Response('{}'))
    document.body.innerHTML = `<button>Priority</button><select aria-label="Sort"><option>Newest</option><option>Oldest</option></select><textarea aria-label="Say something">secret draft</textarea>`
    const [button] = document.body.getElementsByTagName('button')
    const [select] = document.body.getElementsByTagName('select')
    const [box] = document.body.getElementsByTagName('textarea')
    button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    select.selectedIndex = 1
    select.dispatchEvent(new Event('change', { bubbles: true }))
    box.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    box.value = 'secret draft, longer'
    box.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    log.send(false)
    const rows = sent[0].filter((e) => ['menu', 'pick', 'typed'].includes(String(e.kind)))
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'menu', what: 'Priority' }),
      expect.objectContaining({ kind: 'pick', what: 'Sort', to: 'Oldest' }),
      expect.objectContaining({ kind: 'typed', what: 'Say something', chars: 20, was: 12 }),
    ])
    expect(JSON.stringify(sent)).not.toContain('secret')
    document.body.innerHTML = ''
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
