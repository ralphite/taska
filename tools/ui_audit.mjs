// The UI audit (T113): opens every Storybook story in a headless browser, measures visible display problems
// (tools/ui_audit_probe.mjs says which) and files each new one as a Taska bug, with a cropped picture and where it is.
// No model; the same code gives the same findings. A problem is filed once: its signature is kept in the state folder.
//
//   node tools/ui_audit.mjs [--storybook <static build> | --build] [--file <taska url>] [--state <dir>]
//                           [--only <story id part>] [--baseline] [--max <bugs per run>] [--out <dir>]
//
//   --build      build the static Storybook first (web/dist-storybook); otherwise --storybook names a built one
//   --file       file new problems on that Taska (project taska) as open P1 bugs (r1071: a bug is P1 by default);
//                without it, only print them
//   --state      where the signatures already filed are kept (default .logs/ui-audit, outside git)
//   --baseline   record every problem found now as known without filing it (activation: today's are cleaned first)
//   --out        keep the findings (findings.json) and the crops there
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { probe } from './ui_audit_probe.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(path.join(ROOT, 'web', 'package.json'))
const { chromium } = require('playwright')

const args = process.argv.slice(2)
const opt = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const flag = (name) => args.includes(name)
const WORKERS = 4 // one browser, four pages: inside the machine's browser budget
const SKIP = /^(Prototype|Review)\// // not product UI: prototypes and side-by-side reviews
const KINDS = {
  align: 'controls in one row are not vertically centred',
  height: 'buttons side by side differ a little in height',
  icon: 'an icon is not centred on its label',
  wrap: 'a short label wraps onto a second line',
  midword: 'a word is broken in the middle',
  cut: 'text is cut off without an ellipsis',
  overflow: 'the phone scrolls sideways',
}

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.pdf': 'application/pdf' }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const file = path.join(dir, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''))
    fs.readFile(file.endsWith(path.sep) ? path.join(file, 'index.html') : file, (err, data) => {
      if (err) return res.writeHead(404).end()
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data)
    })
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)))
}

// the source file that draws an element: the longest run of its classes found in one component file
let sources = null
function sourceOf(sig) {
  if (!sources) {
    sources = []
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) { if (e.name !== 'stories') walk(p) } else if (/\.tsx?$/.test(e.name) && !/\.(stories|test)\.tsx?$/.test(e.name)) sources.push([path.relative(ROOT, p), fs.readFileSync(p, 'utf8')])
      }
    }
    walk(path.join(ROOT, 'web', 'src'))
  }
  const el = sig.split('|')[1].split(' >> ')[0].split(' in ')[0]
  const words = el.slice(el.indexOf('.') + 1).split(' ').filter(Boolean)
  for (let len = Math.min(words.length, 8); len >= 3; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const run = words.slice(i, i + len).join(' ')
      const hit = sources.filter(([, text]) => text.includes(run))
      if (hit.length && hit.length <= 2) return hit.map(([p]) => p)
    }
  }
  return []
}

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10)

async function audit(sbDir, outDir, only) {
  const index = JSON.parse(fs.readFileSync(path.join(sbDir, 'index.json'), 'utf8'))
  const stories = Object.values(index.entries).filter((e) => e.type === 'story' && !SKIP.test(e.title) && (!only || e.id.includes(only)))
  const server = await serve(sbDir)
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch()
  const found = new Map() // signature -> the problem, where it was seen
  const errors = []
  const frames = {} // how many stories draw a phone frame, a desktop frame
  let next = 0
  async function worker() {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    while (next < stories.length) {
      const story = stories[next++]
      try {
        await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story`, { waitUntil: 'load', timeout: 30000 })
        await page.waitForFunction(() => document.querySelector('#storybook-root')?.childElementCount || document.querySelector('.sb-show-errordisplay'), null, { timeout: 15000 })
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(400) // a story's After() acts 50 ms after drawing; its effects settle
        for (const l of await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-layout]')].map((e) => e.getAttribute('data-layout')))])) frames[l] = (frames[l] || 0) + 1
        for (const f of await page.evaluate(probe)) {
          const sig = hash(f.sig)
          let p = found.get(sig)
          if (!p) found.set(sig, (p = { sig, kind: f.kind, text: f.sig, label: f.label, detail: f.detail, layouts: [], stories: [], count: 0 }))
          p.count++
          if (!p.layouts.includes(f.layout)) p.layouts.push(f.layout)
          if (p.stories.length < 3 && !p.stories.some((s) => s.id === story.id)) p.stories.push({ id: story.id, title: `${story.title} › ${story.name}`, file: story.importPath.replace(/^\.\//, 'web/') })
          if (!p.shot && outDir) {
            try {
              const el = page.locator(`[data-ui-audit="${f.mark}"]`)
              await el.scrollIntoViewIfNeeded({ timeout: 2000 })
              // the box is where the window shows it; the picture is cut from the whole page, so add the scroll
              const bb = await el.boundingBox()
              const [sx, sy] = await page.evaluate(() => [scrollX, scrollY])
              const x = Math.max(0, bb.x + sx - 24), y = Math.max(0, bb.y + sy - 24)
              const shot = path.join(outDir, `${sig}.png`)
              await page.screenshot({ path: shot, fullPage: true, clip: { x, y, width: Math.min(bb.width + 48, 1200), height: Math.min(bb.height + 48, 800) } })
              p.shot = shot
            } catch { /* no picture: the bug says where to look */ }
          }
        }
      } catch (e) {
        errors.push({ id: story.id, error: String(e).split('\n')[0].slice(0, 160) })
      }
    }
    await ctx.close()
  }
  await Promise.all(Array.from({ length: WORKERS }, worker))
  await browser.close()
  server.close()
  for (const p of found.values()) p.source = sourceOf(p.text)
  return { stories: stories.length, frames, problems: [...found.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.text.localeCompare(b.text)), errors }
}

function excepted(p, exceptions) {
  return exceptions.find((x) => x.kind === p.kind && p.text.includes(x.match))
}

function bugText(p) {
  const where = p.stories.map((s) => `\`${s.id}\` (${s.title})`).join(', ')
  const layouts = p.layouts.map((l) => ({ phone: 'phone (393 wide)', desk: 'desktop', none: 'no frame' })[l]).join(', ')
  const detail = Object.entries(p.detail).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' / ') : v}`).join('; ')
  const lines = [
    `**What:** ${KINDS[p.kind]} (${detail}).`,
    `**Where:** ${layouts}; story ${where}${p.count > p.stories.length ? `, ${p.count} places in all` : ''}.`,
    `**Source:** ${p.source.length ? p.source.map((s) => `\`${s}\``).join(', ') : 'not found from its classes'}; story file \`${p.stories[0].file}\`.`,
    `**Element:** \`${p.text.slice(p.kind.length + 1, p.kind.length + 1 + 300).replace(/`/g, "'")}\``,
  ]
  if (p.upload) lines.push('', `![${KINDS[p.kind]}](${p.upload})`)
  lines.push('', `Found by the nightly UI audit (tools/ui_audit.mjs, T113), signature ${p.sig}; [the story](http://127.0.0.1:6007/?path=/story/${p.stories[0].id}). Fixed when \`node tools/ui_audit.mjs --only ${p.stories[0].id}\` no longer lists it.`)
  return lines
}

// each one filed is remembered at once (`filed`), so a run that stops halfway never files it again
async function file(url, problems, filed) {
  const at = `${url.replace(/\/$/, '')}/p/taska`
  for (const p of problems) {
    if (p.shot) {
      const up = await fetch(`${at}/api/file?name=ui-audit-${p.sig}.png`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: fs.readFileSync(p.shot) })
      const res = await up.json().catch(() => ({}))
      if (up.ok && res.f) p.upload = res.f
    }
    const where = p.label ? `: "${p.label.slice(0, 30)}"` : ''
    const title = `UI audit: ${KINDS[p.kind]}${where} (${p.stories[0].title.split(' › ')[0].split('/').slice(-1)[0]})`
    const body = [`new bug P1 now ${title.replace(/\n/g, ' ')}`, ...bugText(p).map((l) => '  ' + l)].join('\n') + '\n'
    const r = await fetch(`${at}/do?by=ui-audit&session=nightly`, { method: 'POST', body })
    const said = await r.text()
    const code = /^ok ([A-Z]\d+) new/m.exec(said)?.[1]
    if (!code) { console.log(`not filed (${p.sig}): ${said.split('\n')[0]}`); continue }
    // Yadong approved filing these as open bugs (T113, 11-06): approved as the page does, so agents take them
    await fetch(`${at}/api/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: `ui-audit-${p.sig}`, commands: [{ op: 'set', ref: code, f: { status: 'open' } }] }) }).catch(() => {})
    filed({ ...p, code })
  }
}

const t0 = Date.now()
let sbDir = opt('--storybook')
if (flag('--build') || !sbDir) {
  sbDir = path.join(ROOT, 'web', 'dist-storybook')
  try {
    execFileSync('npm', ['--prefix', path.join(ROOT, 'web'), 'run', 'build-storybook'], { stdio: 'pipe', maxBuffer: 64 << 20 })
  } catch (e) { // its warnings only when it fails
    console.log(`Error: the Storybook build failed\n${String(e.stderr || e).slice(-3000)}`)
    process.exit(1)
  }
}
const stateDir = opt('--state', path.join(ROOT, '.logs', 'ui-audit'))
const outDir = opt('--out') || fs.mkdtempSync(path.join(os.tmpdir(), 'ui-audit-')) // its own: removed at the end
fs.mkdirSync(outDir, { recursive: true })
const { stories, frames, problems, errors } = await audit(sbDir, outDir, opt('--only'))
const exceptions = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'ui_audit_exceptions.json'), 'utf8')).exceptions
const stateFile = path.join(stateDir, 'known.json')
const known = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {}
const real = problems.filter((p) => !excepted(p, exceptions))
const fresh = real.filter((p) => !known[p.sig])
fs.writeFileSync(path.join(outDir, 'findings.json'), JSON.stringify({ stories, frames, problems, errors }, null, 1))
for (const p of real) console.log(`${known[p.sig] ? 'known' : 'NEW  '} ${p.kind.padEnd(8)} ${p.sig} ${p.stories[0].id} [${p.layouts}] ${JSON.stringify(p.detail)} ${p.source.join(',')}`)
for (const e of errors) console.log(`error ${e.id}: ${e.error}`)
const remember = (list) => {
  const day = new Date().toLocaleDateString('sv')
  for (const p of list) known[p.sig] = { kind: p.kind, code: p.code || null, day, story: p.stories[0].id }
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(stateFile, JSON.stringify(known, null, 1))
}
const filed = []
if (flag('--baseline')) remember(fresh)
else if (opt('--file') && fresh.length) {
  await file(opt('--file'), fresh.slice(0, Number(opt('--max', 10))), (p) => {
    filed.push(p)
    remember([p])
  })
}
if (!opt('--out')) fs.rmSync(outDir, { recursive: true, force: true })
const secs = Math.round((Date.now() - t0) / 1000)
console.log(`ui audit: ${stories} stories (${frames.phone || 0} with a phone frame, ${frames.desk || 0} with a desktop one) in ${secs} s, ${real.length} problems (${problems.length - real.length} excepted), ` +
  `${fresh.length} new${flag('--baseline') ? ', recorded as known' : opt('--file') ? `, filed ${filed.map((p) => p.code).join(' ') || 'none'}` : ''}` +
  `${errors.length ? `, ${errors.length} stories failed to load` : ''}`)
process.exit(errors.length > stories / 10 ? 1 : 0)
