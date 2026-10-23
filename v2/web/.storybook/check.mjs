// T457, R489: Storybook must have every component. Each component of the page (a function or arrow component in
// src/components and src/pages) has to be in a story: imported by a story file, or named in a story file's
// `covers: [...]` (the parts a story shows inside a bigger one). A component with no story fails the build.
//   node .storybook/check.mjs            the check
//   node .storybook/check.mjs --open     and every story of the built Storybook (dist/storybook) opens: no error,
//                                        something drawn (the real page too, for the Pages, Demo and Prototype)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const files = (dir, ok) =>
  readdirSync(join(ROOT, dir)).flatMap((f) => {
    const p = join(dir, f)
    return statSync(join(ROOT, p)).isDirectory() ? files(p, ok) : ok(p) ? [p] : []
  })

// the components: Capitalized functions, and Capitalized arrow functions (not CONSTANTS)
const comps = new Map()
for (const f of files('src', (p) => /^src\/(components|pages)\/[^/]+\.tsx$/.test(p) && !p.includes('.test.'))) {
  const src = readFileSync(join(ROOT, f), 'utf8')
  for (const m of src.matchAll(/^(?:export )?function ([A-Z]\w*)\(/gm)) comps.set(m[1], f)
  for (const m of src.matchAll(/^(?:export )?const ([A-Z]\w*[a-z]\w*) = \(/gm)) comps.set(m[1], f)
}
// what the stories show
const shown = new Set()
for (const f of files('src', (p) => p.endsWith('.stories.tsx'))) {
  const src = readFileSync(join(ROOT, f), 'utf8')
  for (const m of src.matchAll(/import \{([^}]*)\} from '[./]+\/(components|pages)\//g))
    for (const n of m[1].split(',')) shown.add(n.trim().split(/\s+as\s+/)[0])
  for (const m of src.matchAll(/covers: \[([^\]]*)\]/g)) for (const n of m[1].matchAll(/'(\w+)'/g)) shown.add(n[1])
}
const missing = [...comps].filter(([n]) => !shown.has(n))
if (missing.length) {
  console.error(`Storybook: ${missing.length} component(s) without a story (R489):`)
  for (const [n, f] of missing) console.error(`  ${n}  (${f})`)
  console.error('Add a story that shows it, or name it in the covers of the story that shows it.')
  process.exit(1)
}
console.log(`Storybook: all ${comps.size} components are in stories`)

if (process.argv.includes('--open')) {
  const { chromium } = await import('@playwright/test')
  const DIST = join(ROOT, 'dist')
  const TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webm': 'audio/webm',
    '.woff2': 'font/woff2',
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
  const index = JSON.parse(readFileSync(join(DIST, 'storybook', 'index.json'), 'utf8'))
  const stories = Object.values(index.entries).filter((e) => e.type === 'story')
  const browser = await chromium.launch()
  const bad = []
  let i = 0
  const worker = async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    while (i < stories.length) {
      const s = stories[i++]
      const errors = []
      page.removeAllListeners('pageerror')
      page.on('pageerror', (e) => errors.push(String(e.message || e)))
      await page.goto(`${base}iframe.html?id=${s.id}&viewMode=story`)
      let ok = false
      for (let t = 0; t < 60 && !ok; t++) {
        await page.waitForTimeout(250)
        ok = await page.evaluate(() => {
          if (document.body.classList.contains('sb-show-errordisplay')) return true
          const root = document.querySelector('#storybook-root')
          const f = root?.querySelector('iframe[src*="app.html"]')
          if (f) return !!f.contentDocument?.querySelector('#app, #home, #root > *')
          return !!root?.innerHTML.trim()
        })
      }
      const failed = await page.evaluate(() => document.body.classList.contains('sb-show-errordisplay'))
      if (failed || !ok || errors.length) bad.push(`${s.id}: ${failed ? 'error' : !ok ? 'nothing drawn' : errors[0]}`)
    }
    await page.close()
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  await browser.close()
  srv.close()
  if (bad.length) {
    console.error(`Storybook: ${bad.length} of ${stories.length} stories do not open:`)
    for (const b of bad) console.error('  ' + b)
    process.exit(1)
  }
  console.log(`Storybook: all ${stories.length} stories open`)
}
