// B523: a story must look exactly like the page. For each pair below the same part is drawn twice from the built
// Storybook - once by its component story, once by the real page (app.html, the page's own build) on the same saved
// data, at the same screen size, scheme and clock - and the two pictures must be the same, pixel for pixel. Any
// difference (a frame, a size, a style the story does not get, a state it fakes) fails the build.
//   node .storybook/same.mjs [dist]        (run by the build after check.mjs --open)
import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle')
const ROOT = new URL('..', import.meta.url).pathname
const DIST = join(ROOT, process.argv[2] || 'dist')
const OUT = join(ROOT, 'test-results', 'same') // the two pictures of each difference, to look at

// story id, the page's address, the part (a selector in both), on which screens; hover: point at this in both
const PAIRS = [
  { story: 'components-item-list-views--active', path: '/p/shop/', part: '#list' },
  { story: 'components-item-list-views--needs-you', path: '/p/shop/?status=wait', part: '#list' },
  {
    story: 'components-item-list-views--active',
    path: '/p/shop/',
    part: '#list',
    hover: '#list [data-act="open"][data-n="43"]',
    on: ['d'],
  },
  { story: 'components-item-page-by-item-status--blocked', path: '/p/shop/B2', part: '#detailView' },
  { story: 'components-item-page-by-item-status--question', path: '/p/shop/T7', part: '#detailView' },
  { story: 'components-item-page-by-item-status--proposed-with-preview', path: '/p/shop/I4', part: '#detailView' },
  { story: 'components-document-reading--with-comments', path: '/p/shop/D1', part: '#detailView', on: ['d'] },
  { story: 'components-input-box-writing--empty', path: '/p/shop/', part: '#composer' },
  { story: 'components-settings--agents', path: '/p/shop/agents', part: '#projectBody', on: ['d'] },
  { story: 'components-home-page--home-page', path: '/', part: 'main' },
  // a row alone and in the list; the pointer on it (the story's fixed hover against a real pointer on the page)
  { story: 'components-item-list-item-row--row-open', path: '/p/shop/', part: '#list article[data-n="3"]', on: ['d'] },
  {
    story: 'components-item-list-item-row--row-hover',
    path: '/p/shop/',
    part: '#list article[data-n="3"]',
    pageHover: '#list [data-act="open"][data-n="3"]',
    on: ['d'],
  },
  {
    story: 'components-item-list-item-row--row-in-progress',
    path: '/p/shop/',
    part: '#list article[data-n="1"]',
    on: ['d'],
  },
  // the frame
  { story: 'components-top-bar-and-list-head-project-bar--project-bar', path: '/p/shop/', part: '#projBar', on: ['d'] },
  { story: 'components-top-bar-and-list-head-list-head--list-head', path: '/p/shop/', part: '#mainHead' },
  { story: 'components-top-bar-and-list-head-tabs--tabs-items', path: '/p/shop/', part: '#tabs', on: ['p'] },
  { story: 'components-sidebar--sidebar', path: '/p/shop/', part: '#drawer', on: ['d'] },
  // the web page's own frame settles at 484 or 486 px high from one load to another (its page measures itself), on
  // the page too: its top 500 px are compared
  { story: 'components-document-reading--web-page', path: '/p/shop/D2', part: '#detailView', on: ['d'], top: 500 },
  { story: 'components-settings--projects', path: '/p/shop/projects', part: '#projectBody', on: ['d'] },
  { story: 'components-settings--use-on-your-phone', path: '/p/shop/phone', part: '#projectBody', on: ['d'] },
  { story: 'components-side-lists--list-documents', path: '/p/shop/docs', part: '#sideList', on: ['d'] },
  { story: 'components-inputs-inputs-tab--inputs-tab', path: '/p/shop/inputs', part: '#inputsView', on: ['p'] },
  {
    story: 'components-menus-and-sheets-sheets--keys',
    path: '/p/shop/',
    part: '#dlg',
    inset: 24,
    keys: ['Shift+?'],
    on: ['d'],
  },
  {
    story: 'components-menus-and-sheets-sheets--command-palette',
    path: '/p/shop/',
    part: '#dlg',
    inset: 24,
    keys: ['Meta+k'],
    on: ['d'],
  },
]
const SIZE = { d: { width: 1440, height: 900 }, p: { width: 393, height: 852 } }
const TIME = Date.parse('2026-10-22T16:30:00-07:00') // one clock for both, so "5 min ago" reads the same

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webm': 'audio/webm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
}
const srv = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (p.endsWith('/')) p += 'index.html'
  try {
    const b = readFileSync(join(DIST, p))
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' })
    res.end(b)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${srv.address().port}/storybook/`

const browser = await chromium.launch()
// a busy computer can be slow to draw: a part that does not show is asked for once more before it counts as missing
const shot = async (url, pair, mode) => {
  try {
    return await shotOnce(url, pair, mode)
  } catch {
    return await shotOnce(url, pair, mode)
  }
}
const shotOnce = async (url, pair, mode) => {
  const page = await browser.newPage({ viewport: SIZE[mode[0]] })
  await page.clock.install({ time: TIME })
  await page.goto(url)
  const frame = page
  if (!url.includes('iframe.html')) {
    await page.waitForTimeout(1500)
    for (const k of pair.keys || []) await page.keyboard.press(k)
  }
  const el = frame.locator(pair.part).first()
  await el.waitFor({ state: 'visible', timeout: 40000 })
  // pictures loaded, late layout settled
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 10000 })
    .catch(() => {})
  await page.waitForTimeout(pair.settle || 1200)
  // the layout holds still (a web page document sizes its frame once its page has drawn): the part and every frame in
  // it the same size twice in a row
  const sizes = () =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel)
      return el ? [el, ...el.querySelectorAll('iframe')].map((e) => e.getBoundingClientRect().height).join() : ''
    }, pair.part)
  for (let last = '', i = 0; i < 20; i++) {
    const now = await sizes()
    if (now === last) break
    last = now
    await page.waitForTimeout(400)
  }
  await page.mouse.move(-10, -10) // the pointer off the page, so nothing is pointed at by chance
  const hover = pair.hover || (!url.includes('iframe.html') && pair.pageHover)
  if (hover) {
    await frame.locator(hover).first().hover()
    await page.waitForTimeout(300)
  }
  // the part's box on the pixel grid: the same part sits at a fraction of a pixel elsewhere on the page (rows above
  // it are 65.88 px high), so both are cut at whole pixels, the same size
  const bb = await el.boundingBox()
  // inset: leave out a part's rounded corners, through which shows what is behind it (another part of the page)
  const n = pair.inset || 0
  const clip = {
    x: Math.round(bb.x) + n,
    y: Math.round(bb.y) + n,
    width: Math.round(bb.width) - 2 * n,
    height: Math.min(pair.top || 1e9, Math.round(bb.height) - 2 * n),
  }
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' })
  await page.close()
  return png
}
const bad = []
const jobs = []
for (const pair of PAIRS)
  for (const m of pair.on || ['d', 'p']) for (const scheme of ['light', 'dark']) jobs.push([pair, m, scheme])
const one = async ([pair, m, scheme]) => {
  {
    const mode = m + scheme[0]
    if (m === 'p' && pair.part === '#projectBody') return
    let a, b
    try {
      a = await shot(`${base}iframe.html?id=${pair.story}&viewMode=story&single=1&globals=scheme:${scheme}`, pair, mode)
      b = await shot(`${base}app.html#path=${encodeURIComponent(pair.path)}&theme=${scheme}`, pair, mode)
    } catch (e) {
      bad.push(`${pair.story}--${mode}: not drawn (${String(e.message).split('\n')[0]})`)
      return
    }
    const A = PNG.sync.read(a),
      B = PNG.sync.read(b)
    let diff = A.width !== B.width || A.height !== B.height ? -1 : 0
    // a pixel differs when a colour channel is off by more than a rounding (the edge of a rounded corner can be one
    // or two values apart, drawn at another place on the screen); anything a person could see is far more
    if (!diff) for (let i = 0; i < A.data.length; i++) if (Math.abs(A.data[i] - B.data[i]) > 8) diff++
    if (diff) {
      const name = `${pair.story}${pair.hover ? '-hover' : ''}--${mode}`
      mkdirSync(OUT, { recursive: true })
      writeFileSync(join(OUT, name + '--story.png'), a)
      writeFileSync(join(OUT, name + '--page.png'), b)
      console.error('  differs:', name, diff < 0 ? `${A.width}x${A.height} vs ${B.width}x${B.height}` : diff)
      bad.push(
        `${name}: ` +
          (diff < 0
            ? `size ${A.width}x${A.height} in the story, ${B.width}x${B.height} on the page`
            : `${diff} values differ`),
      )
    }
  }
}
let next = 0
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < jobs.length) await one(jobs[next++])
  }),
)
await browser.close()
srv.close()
if (bad.length) {
  console.error(`Storybook: ${bad.length} stories do not look like the page (pictures in test-results/same):`)
  for (const b of bad) console.error('  ' + b)
  process.exit(1)
}
console.log(`Storybook: ${PAIRS.length} parts look the same in their stories and on the page`)
