// T457: every story as a picture, to look at: on the desktop and the phone, light and dark. Also tells the stories
// that do not open (an error on the page, or nothing drawn).
//   node .storybook/shots.mjs <storybook url> <out folder> [filter] [--modes=dl,pl,dd,pd]
// The url is a running Storybook (storybook dev) or a built one served over http.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const [url, out, filter = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const modesArg = process.argv.find((a) => a.startsWith('--modes='))
const MODES = (modesArg ? modesArg.slice(8) : 'dl,pl').split(',')
const SIZE = { d: { width: 1440, height: 900 }, p: { width: 393, height: 852 } }
mkdirSync(out, { recursive: true })

const index = await (await fetch(new URL('index.json', url))).json()
const stories = Object.values(index.entries).filter(
  (e) => e.type === 'story' && (!filter || e.id.includes(filter) || e.title.includes(filter)),
)
const browser = await chromium.launch()
const bad = []
const work = stories.flatMap((s) => MODES.map((m) => [s, m]))
async function one(page, [s, m]) {
  const scheme = m[1] === 'd' ? 'dark' : 'light'
  await page.setViewportSize(SIZE[m[0]])
  const errors = []
  page.removeAllListeners('pageerror')
  page.on('pageerror', (e) => errors.push(String(e.message || e)))
  await page.goto(new URL(`iframe.html?id=${s.id}&viewMode=story&single=1&globals=scheme:${scheme}`, url).href)
  await page.waitForSelector('#storybook-root > *, .sb-show-errordisplay', { timeout: 15000 }).catch(() => {})
  // the real page in a frame needs a moment to draw; a played story its steps
  const frame = await page.$('iframe')
  await page.waitForTimeout(frame ? 2500 : 600)
  const failed = await page.evaluate(() => document.body.classList.contains('sb-show-errordisplay'))
  const empty = await page.evaluate(() => !document.querySelector('#storybook-root')?.innerHTML.trim())
  if (failed || empty || errors.length) bad.push({ id: s.id, m, failed, empty, errors: errors.slice(0, 3) })
  await page.screenshot({ path: `${out}/${s.id}--${m}.png`, fullPage: false })
}
const N = Number(process.env.SHOTS_N || 4)
const pages = await Promise.all(Array.from({ length: N }, () => browser.newPage()))
let i = 0
await Promise.all(
  pages.map(async (page) => {
    while (i < work.length) await one(page, work[i++])
  }),
)
await browser.close()
writeFileSync(`${out}/_bad.json`, JSON.stringify(bad, null, 1))
console.log(`${work.length} pictures of ${stories.length} stories in ${out}; ${bad.length} with a problem`)
for (const b of bad) console.log(' ', b.id, b.m, b.failed ? 'error' : '', b.empty ? 'empty' : '', b.errors.join(' | '))
