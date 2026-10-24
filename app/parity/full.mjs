// The whole acceptance of one build of the rewrite: every scenario on every variant, then the sweeps of every item
// and every document, a few runs at a time (each on its own ports and data copies).
//   node full.mjs <sha> [--jobs 3] [--only scenarios|sweeps]
// Runs are named full-<sha>-<part>; each writes out/<run>/report.json as it goes.
import { chromium } from 'playwright'
import { kindsOf, run } from './lib/run.mjs'
import { VARIANTS } from './lib/twin.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { PARITY } from './lib/servers.mjs'

const argv = process.argv.slice(2)
const sha = argv[0]
// one run at a time (two browsers) by default: Yadong uses this machine
const jobs = argv.includes('--jobs') ? +argv[argv.indexOf('--jobs') + 1] : 1
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null
if (!sha) throw new Error('usage: node full.mjs <sha>')
const b = `new@${sha}`
const variants = Object.keys(VARIANTS)

const parts = []
if (only !== 'sweeps') parts.push({ id: `full-${sha}-scenarios` })
if (only !== 'scenarios')
  for (const sw of ['sweep-items', 'sweep-docs']) for (const v of variants) parts.push({ id: `full-${sha}-${sw}-${v}`, scenarios: [sw], variants: [v] })

const logDir = path.join(PARITY, 'out', `full-${sha}-logs`)
fs.mkdirSync(logDir, { recursive: true })
const browser = await chromium.launch()
const queue = [...parts]
const done = []
async function worker() {
  for (let p = queue.shift(); p; p = queue.shift()) {
    const file = path.join(logDir, `${p.id}.log`)
    console.log(`start ${p.id}`)
    const rep = await run({ a: 'old', b, scenarios: p.scenarios, variants: p.variants, runId: p.id, browser, log: (l) => fs.appendFileSync(file, l + '\n') })
    const bad = rep.results.filter((r) => kindsOf(r).size)
    console.log(`done ${p.id}: ${rep.results.length} runs, ${rep.results.reduce((n, r) => n + r.steps.length, 0)} steps, ${bad.length} with differences`)
    done.push(rep.run)
  }
}
try {
  await Promise.all(Array.from({ length: jobs }, worker))
} finally {
  await browser.close()
}
console.log(`all done: ${done.join(' ')}`)
process.exit(0)
