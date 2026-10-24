// Is the parity tool to be trusted? Two checks, both must pass:
//   1. the old Taska against itself: every scenario, every variant, nothing found (run twice: steady, not lucky);
//   2. each planted fault (mutants.mjs) against the old Taska: found where it is, of the kind it is, and not found
//      where it is not (a dark-only fault leaves light alone).
//
//   node selftest.mjs [--only shade,flash] [--skip-same] [--scenarios home,list]   -> out/selftest/summary.json
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { PARITY } from './lib/servers.mjs'
import { kindsOf, run } from './lib/run.mjs'
import { MUTANTS } from './mutants.mjs'

const argv = process.argv.slice(2)
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null
const skipSame = argv.includes('--skip-same')
// old vs old on these scenarios only (default: all)
const sameScenarios = argv.includes('--scenarios') ? argv[argv.indexOf('--scenarios') + 1].split(',') : undefined
const OUT = path.join(PARITY, 'out', 'selftest')
fs.mkdirSync(OUT, { recursive: true })
const sumFile = path.join(OUT, 'summary.json')
const summary = fs.existsSync(sumFile) ? JSON.parse(fs.readFileSync(sumFile, 'utf8')) : { same: [], mutants: {} }
const save = () => fs.writeFileSync(sumFile, JSON.stringify(summary, null, 1))
// each run's step-by-step lines go to out/selftest/<run>.log (three runs at once would mix them on the screen)
const fileLog = (id) => (line) => fs.appendFileSync(path.join(OUT, `${id}.log`), line + '\n')
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.log')) fs.rmSync(path.join(OUT, f))
const browser = await chromium.launch()
try {
  // the two passes of old vs old and the planted faults run at the same time (each on its own ports and data): the
  // tool has to be right on a busy machine too
  const same = async (k) => {
    const rep = await run({ a: 'old', b: 'old', scenarios: sameScenarios, runId: `selftest-same-${k}`, browser, log: fileLog(`selftest-same-${k}`) })
    const found = rep.results.filter((r) => kindsOf(r).size).map((r) => `${r.scenario}/${r.variant}: ${[...kindsOf(r)].join(',')}`)
    const checks = rep.results.reduce((n, r) => n + r.steps.length, 0)
    summary.same[k - 1] = { run: rep.run, runs: rep.results.length, steps: checks, found, pass: found.length === 0, at: rep.finished }
    save()
    console.log(`old vs old #${k}: ${rep.results.length} runs, ${checks} steps, ${found.length ? 'FOUND ' + found.join('; ') : 'nothing found'}`)
  }
  if (!skipSame && !only) summary.same = []
  await Promise.all([...(!skipSame && !only ? [same(1), same(2)] : []), mutants()])
} finally {
  await browser.close()
}

async function mutants() {
  for (const m of MUTANTS) {
    if (only && !only.includes(m.name)) continue
    const e = m.expect
    const variants = [...new Set([...e.variants, ...(e.clean || [])])]
    const rep = await run({ a: 'old', b: `mutant:${m.name}`, scenarios: [e.scenario], variants, runId: `selftest-${m.name}`, browser, log: fileLog(`selftest-${m.name}`) })
    const rows = rep.results.map((r) => {
      const kinds = kindsOf(r)
      const wanted = e.variants.includes(r.variant)
      if (wanted && r.steps.some((s) => s.note?.film)) kinds.add('film-note') // screens during a step, for a person to judge
      let hit = e.cats.some((c) => kinds.has(c))
      if (hit && e.step) hit = r.steps.some((s) => !s.same && s.label.includes(e.step) && e.cats.some((c) => c in s.cats))
      return { variant: r.variant, kinds: [...kinds], wanted, ok: wanted ? hit : kinds.size === 0 }
    })
    const pass = rows.length === variants.length && rows.every((x) => x.ok)
    summary.mutants[m.name] = { title: m.title, expect: e, rows, pass, run: rep.run, at: rep.finished }
    save()
    console.log(`${pass ? 'CAUGHT ' : 'MISSED '} ${m.name}: ${rows.map((x) => `${x.variant}=${x.kinds.join('+') || 'nothing'}${x.ok ? '' : ' (wrong)'}`).join('  ')}`)
  }
}
const mut = Object.values(summary.mutants)
console.log(
  `old vs old: ${summary.same.map((x) => (x.pass ? 'pass' : 'FAIL')).join(', ') || 'not run'}; planted faults caught: ${mut.filter((x) => x.pass).length}/${mut.length}`,
)
process.exit(0)
