// What a set of runs found, step by step, grouped so one difference seen on several variants is one line:
//   node tools/digest.mjs <run>... [--notes]
// Each line: scenario, step, kinds, the variants it shows on, and the pictures (old, new) of the first of them.
// --notes adds what is only for a person to judge (screens during a step, scroll positions).
import fs from 'node:fs'
import path from 'node:path'
import { PARITY } from '../lib/servers.mjs'

const argv = process.argv.slice(2)
const notes = argv.includes('--notes')
const groups = new Map()
for (const id of argv.filter((x) => !x.startsWith('--'))) {
  const rep = JSON.parse(fs.readFileSync(path.join(PARITY, 'out', id, 'report.json'), 'utf8'))
  for (const r of rep.results) {
    const dir = `${id}/${r.scenario}--${r.variant}`
    if (r.error) add(`${r.scenario} | 场景没跑完: ${r.error.slice(0, 120)}`, r.variant, null)
    if (r.data && !r.data.same) add(`${r.scenario} | 数据: ${r.data.diffs.map((d) => d.what).join('; ')}`, r.variant, null)
    if (r.speed?.slow) add(`${r.scenario} | 速度: ${r.speed.worst.map((w) => `${w.label} ${w.a}→${w.b}ms`).join(', ')}`, r.variant, null)
    for (const s of r.steps) {
      const kinds = Object.keys(s.cats || {})
      if (kinds.length) add(`${r.scenario} | ${s.label} | ${kinds.join(',')}`, r.variant, s.files?.a ? [`${dir}/${s.files.a}`, `${dir}/${s.files.b}`] : null)
      if (notes && s.note?.film) add(`${r.scenario} | ${s.label} | 过程画面（需人看）`, r.variant, null)
    }
  }
}
function add(key, variant, pics) {
  const g = groups.get(key) || { variants: [], pics: null }
  g.variants.push(variant)
  g.pics ||= pics
  groups.set(key, g)
}
for (const [k, g] of groups) console.log(`${k}  [${g.variants.join(' ')}]${g.pics ? `  ${g.pics.join(' ')}` : ''}`)
console.log(`${groups.size} distinct`)
