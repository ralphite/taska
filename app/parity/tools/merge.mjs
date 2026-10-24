// Puts the results of a run done again (some scenarios) into an earlier run, in place of the same scenario/variant,
// pictures included: e.g. the self-test's passes after a scenario was fixed.
//   node tools/merge.mjs <into> <from>
import fs from 'node:fs'
import path from 'node:path'
import { PARITY } from '../lib/servers.mjs'

const [into, from] = process.argv.slice(2)
const OUT = path.join(PARITY, 'out')
const load = (id) => JSON.parse(fs.readFileSync(path.join(OUT, id, 'report.json'), 'utf8'))
const a = load(into)
const b = load(from)
for (const r of b.results) {
  const dir = `${r.scenario}--${r.variant}`
  const k = a.results.findIndex((x) => x.scenario === r.scenario && x.variant === r.variant)
  if (k >= 0) a.results[k] = r
  else a.results.push(r)
  fs.rmSync(path.join(OUT, into, dir), { recursive: true, force: true })
  if (fs.existsSync(path.join(OUT, from, dir))) fs.cpSync(path.join(OUT, from, dir), path.join(OUT, into, dir), { recursive: true })
}
a.merged = [...(a.merged || []), { from, at: b.finished, scenarios: [...new Set(b.results.map((r) => r.scenario))] }]
fs.writeFileSync(path.join(OUT, into, 'report.json'), JSON.stringify(a, null, 1))
console.log(`${into}: ${b.results.length} results from ${from}`)
