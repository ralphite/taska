// The UI audit's measuring rules on small hand-made pages (T113): each problem it must find, and each look that is
// meant and must not be reported. Needs Chromium (cd web && npx playwright install chromium).
//   node --test tools/ui_audit.test.mjs
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { probe } from './ui_audit_probe.mjs'

const require = createRequire(new URL('../web/package.json', import.meta.url))
const { chromium } = require('playwright')
let browser, page
before(async () => {
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
})
after(() => browser.close())

const BTN = 'height:32px;width:80px;font:14px sans-serif;padding:0;border:1px solid'
async function kinds(html) {
  await page.setContent(`<body style="margin:0;font:14px/20px sans-serif"><div id="storybook-root">${html}</div></body>`)
  return (await page.evaluate(probe)).map((f) => f.kind)
}

test('align: a button lower than its neighbour', async () => {
  assert.deepEqual(await kinds(`<div style="display:flex;align-items:center;height:60px"><button style="${BTN}">A</button><button style="${BTN};align-self:flex-end">B</button></div>`), ['align'])
})

test('align: controls centred in their row are fine', async () => {
  assert.deepEqual(await kinds(`<div style="display:flex;align-items:center"><button style="${BTN}">A</button><button style="${BTN};height:60px">B</button></div>`), [])
})

test('align: rows aligned to the end mean it (attachments of different sizes)', async () => {
  assert.deepEqual(await kinds(`<div style="display:flex;align-items:flex-end"><button style="${BTN};height:80px">A</button><button style="${BTN}">B</button></div>`), [])
})

test('align: a multi-line row puts its controls at the top by design', async () => {
  assert.deepEqual(await kinds(`<div style="display:flex;align-items:flex-start;width:300px"><button style="${BTN}">A</button>` +
    `<p style="margin:0;width:120px">a title long enough to take two lines</p><button style="${BTN};margin-top:9px">B</button></div>`), [])
})

test('align: in a multi-line row, a small control at the top sits on the first line', async () => {
  const row = (undo) => `<div style="display:flex;align-items:flex-start;width:200px"><p style="margin:0;width:120px">a line of words long enough to take two lines</p><button style="height:24px;border:1px solid;${undo}">Undo</button></div>`
  assert.deepEqual(await kinds(row('margin-top:-2px')), [])
  assert.deepEqual(await kinds(row('margin-top:2px')), ['align'])
})

test('align: the frames around a story are scaffolding', async () => {
  assert.deepEqual(await kinds(`<div style="display:flex;align-items:flex-start;gap:8px"><figure style="margin:0"><div data-layout="phone" style="width:100px;height:50px"><button style="${BTN}">A</button></div></figure>` +
    `<figure style="margin:0;padding-top:20px"><div data-layout="desk" style="width:100px;height:90px"><button style="${BTN}">B</button></div></figure></div>`), [])
})

test('height: a pill whose buttons differ in height', async () => {
  assert.deepEqual(await kinds(`<div style="display:inline-flex;align-items:center;border:1px solid;border-radius:9999px;height:40px"><button style="${BTN};height:36px">A</button><button style="${BTN};height:28px">B</button></div>`), ['height'])
})

test('height: a bare icon button in a pill draws no box to compare', async () => {
  assert.deepEqual(await kinds(`<div style="display:inline-flex;align-items:center;border:1px solid;border-radius:9999px;height:40px"><button style="${BTN};height:36px">A</button><button style="height:28px;width:28px;border:0;background:none">B</button></div>`), [])
})

test('height: two chips side by side, one a little taller', async () => {
  assert.deepEqual(await kinds(`<div style="display:flex;align-items:center"><span style="display:flex;border:1px solid;height:36px"><button>Play</button><button>Words</button></span><a href="#" style="display:flex;border:1px solid;height:44px">file.pdf</a></div>`), ['height'])
})

test('height: a picture beside a chip differs on purpose', async () => {
  assert.deepEqual(await kinds(`<div style="display:flex;align-items:center"><button style="${BTN};height:80px">A</button><button style="${BTN};height:36px">B</button></div>`), [])
})

test('icon: an icon above the middle of its label', async () => {
  assert.deepEqual(await kinds(`<button style="display:inline-flex;align-items:flex-start;gap:4px;height:40px;font:14px/40px sans-serif"><svg width="16" height="16"></svg><span>Accept</span></button>`), ['icon'])
})

test('icon: an icon over its label (a column) is fine', async () => {
  assert.deepEqual(await kinds(`<button style="display:flex;flex-direction:column;align-items:center;gap:4px"><svg width="20" height="20"></svg><span>Done</span></button>`), [])
})

test('wrap: a short button label on two lines', async () => {
  assert.deepEqual(await kinds(`<button style="width:60px;font:14px/18px sans-serif">Send back now</button>`), ['wrap'])
})

test('wrap: a long label (a row drawn as a button) may wrap', async () => {
  assert.deepEqual(await kinds(`<button style="width:160px;text-align:left">This is a whole sentence that is the row's title and wraps on purpose</button>`), [])
})

test('midword: a word broken in a box narrower than it', async () => {
  assert.deepEqual(await kinds(`<p style="width:40px;overflow-wrap:break-word">dropped items</p>`), ['midword'])
})

test('midword: codes, paths and Chinese may break anywhere', async () => {
  assert.deepEqual(await kinds(`<p style="width:40px;overflow-wrap:anywhere">web/src/ui/Files.tsx</p><p style="width:40px;overflow-wrap:anywhere">status=open|dropped&amp;wait=1</p><p style="width:40px;overflow-wrap:anywhere">放在右边我觉得不合适</p>`), [])
})

test('cut: text cut off by its box', async () => {
  assert.deepEqual(await kinds(`<div style="width:60px;overflow:hidden;white-space:nowrap"><span>a label far too long</span></div>`), ['cut'])
})

test('cut: an ellipsis, a fade or a scroller is meant', async () => {
  assert.deepEqual(await kinds(`<div style="width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">a label far too long</div>` +
    `<div style="width:60px;overflow:hidden;white-space:nowrap;mask-image:linear-gradient(to right,black,transparent)">a label far too long</div>` +
    `<div style="width:60px;overflow-x:auto;white-space:nowrap">a label far too long</div>`), [])
})

test('overflow: the phone scrolls sideways', async () => {
  assert.deepEqual(await kinds(`<div data-layout="phone" style="width:393px;height:200px;overflow-y:auto"><div style="width:420px;height:20px"></div></div>`), ['overflow'])
})

test('overflow: a row that scrolls inside the phone is fine', async () => {
  assert.deepEqual(await kinds(`<div data-layout="phone" style="width:393px;height:200px;overflow-y:auto"><div style="overflow-x:auto"><div style="width:600px;height:20px"></div></div></div>`), [])
})
