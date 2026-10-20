import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { VIEWS, isPage } from './pages'

describe('the pages the service worker keeps', () => {
  it('are the views the server opens the page on', () => {
    const py = readFileSync(resolve(process.cwd(), '../server/taska/web.py'), 'utf8')
    const m = py.match(/VIEW_PATH = re\.compile\(r"\/\((.*?)\)"\)/)
    expect(m?.[1]).toBe(VIEWS)
  })
  it('take the home page and every view, not the API or files', () => {
    for (const p of ['/', '/p/x/', '/p/x/B03', '/p/x/inputs', '/p/x/docs']) expect(isPage(p), p).toBe(true)
    for (const p of ['/api/projects', '/p/x/api/state', '/p/x/f/f1-a.png', '/p/x/B03/more', '/k/abc/'])
      expect(isPage(p), p).toBe(false)
  })
})
