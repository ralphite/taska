// A short summary of a run, and what changed since an earlier run (newly the same, newly different).
//   node tools/summary.mjs <run> [<earlier run>]
import fs from 'node:fs'
import path from 'node:path'
import { PARITY } from '../lib/servers.mjs'
import { kindsOf } from '../lib/run.mjs'

const load = (id) => JSON.parse(fs.readFileSync(path.join(PARITY, 'out', id, 'report.json'), 'utf8'))
const [id, prevId] = process.argv.slice(2)
const key = (r) => `${r.scenario} / ${r.variant}`
// a step's differences, by label: "label: pixels,text"
const stepsOf = (r) => new Map(r.steps.filter((s) => !s.same).map((s) => [s.label, Object.keys(s.cats).join(',')]))
const cur = load(id)
const prev = prevId ? load(prevId) : null
console.log(`${cur.run}: ${cur.a.title} vs ${cur.b.title}`)
for (const r of cur.results) {
  const k = [...kindsOf(r)]
  const n = r.steps.filter((s) => !s.same).length
  let line = `${k.length ? 'DIFF' : 'same'}  ${key(r).padEnd(30)} ${k.join(',')}${n ? `  (${n}/${r.steps.length} steps)` : ''}${r.error ? `  ERROR ${r.error}` : ''}`
  const p = prev?.results.find((x) => key(x) === key(r))
  if (p) {
    const [a, b] = [stepsOf(p), stepsOf(r)]
    const fixed = [...a.keys()].filter((l) => !b.has(l))
    const broke = [...b.keys()].filter((l) => !a.has(l))
    if (fixed.length) line += `\n        now the same: ${fixed.join(' | ')}`
    if (broke.length) line += `\n        newly different: ${broke.map((l) => `${l} (${b.get(l)})`).join(' | ')}`
  }
  console.log(line)
}
