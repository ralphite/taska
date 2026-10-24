// Runs the parity scenarios on two Taska versions and writes a report (out/<run>/report.json, shown by the viewer).
//
//   node compare.mjs --a old --b new                      old snapshot against the rewrite
//   node compare.mjs --a old --b old                      the tool's own check: must find nothing
//   node compare.mjs --a old --b mutant:<name>            the tool's own check: must find the planted fault
//   options: --scenarios home,approve  --variants desk-light,phone-dark  --run <name>  --ports door,a,b
//
// Every scenario runs once per variant (desktop 1440 / phone 393, light / dark), each time on fresh copies of the
// data snapshot, with both servers started for it and stopped after; then their databases are compared too.
import { kindsOf, run } from './lib/run.mjs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i].replace(/^--/, '')
  args[k] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true
}
const list = (x) => (typeof x === 'string' ? x.split(',') : undefined)
const report = await run({
  a: args.a || 'old',
  b: args.b || 'new',
  scenarios: list(args.scenarios),
  variants: list(args.variants),
  runId: typeof args.run === 'string' ? args.run : undefined,
  ports: list(args.ports)?.map(Number),
})
const bad = report.results.filter((r) => kindsOf(r).size)
console.log(`done: ${report.results.length} runs, ${bad.length} with differences or errors -> out/${report.run}/report.json`)
for (const r of bad) console.log(`  ${r.scenario} / ${r.variant}: ${[...kindsOf(r)].join(', ')}`)
process.exit(0)
