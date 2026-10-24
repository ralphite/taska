// Judges saved runs again by the current rules (speed, motion), without running them: the steps' captures and
// times are in report.json. Rewrites each report, and the self-test summary when given --selftest.
//   node tools/rejudge.mjs <run>... [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { PARITY } from '../lib/servers.mjs'
import { MUTANTS } from '../mutants.mjs'
import { errorsCheck, kindsOf, loadScenarios, speedOf } from '../lib/run.mjs'

const argv = process.argv.slice(2)
const ids = argv.filter((x) => !x.startsWith('--'))
for (const id of ids) {
  const f = path.join(PARITY, 'out', id, 'report.json')
  const rep = JSON.parse(fs.readFileSync(f, 'utf8'))
  const untimed = new Set((await loadScenarios()).filter((x) => x.untimed).map((x) => x.id))
  for (const r of rep.results) {
    if (untimed.has(r.scenario)) for (const st of r.steps) if (st.kind === 'check') st.untimed = true
    errorsCheck(r)
    r.speed = speedOf(r.steps)
  }
  fs.writeFileSync(f, JSON.stringify(rep, null, 1))
  const bad = rep.results.filter((r) => kindsOf(r).size)
  console.log(`${id}: ${rep.results.length} runs, ${bad.length} with differences${bad.length ? ': ' + bad.map((r) => `${r.scenario}/${r.variant} ${[...kindsOf(r)].join(',')}`).join('; ') : ''}`)
}
if (argv.includes('--selftest')) {
  const sf = path.join(PARITY, 'out', 'selftest', 'summary.json')
  const sum = JSON.parse(fs.readFileSync(sf, 'utf8'))
  for (const x of sum.same) {
    const rep = JSON.parse(fs.readFileSync(path.join(PARITY, 'out', x.run, 'report.json'), 'utf8'))
    x.found = rep.results.filter((r) => kindsOf(r).size).map((r) => `${r.scenario}/${r.variant}: ${[...kindsOf(r)].join(',')}`)
    x.pass = x.found.length === 0
  }
  for (const [name, m] of Object.entries(sum.mutants)) {
    m.expect = MUTANTS.find((x) => x.name === name)?.expect || m.expect // as the fault is described now
    const rep = JSON.parse(fs.readFileSync(path.join(PARITY, 'out', m.run, 'report.json'), 'utf8'))
    m.rows = rep.results.map((r) => {
      const kinds = kindsOf(r)
      const wanted = m.expect.variants.includes(r.variant)
      if (wanted && r.steps.some((s) => s.note?.film)) kinds.add('film-note')
      let hit = m.expect.cats.some((c) => kinds.has(c))
      if (hit && m.expect.step) hit = r.steps.some((s) => !s.same && s.label.includes(m.expect.step) && m.expect.cats.some((c) => c in s.cats))
      return { variant: r.variant, kinds: [...kinds], wanted, ok: wanted ? hit : kinds.size === 0 }
    })
    m.pass = m.rows.every((x) => x.ok)
    console.log(`${m.pass ? 'CAUGHT' : 'MISSED'} ${name}`)
  }
  sum.rejudged = new Date().toISOString()
  fs.writeFileSync(sf, JSON.stringify(sum, null, 1))
}
