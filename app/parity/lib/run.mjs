// One comparison run: scenarios x variants on two versions, each pair on fresh data, then the report.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { PARITY, RUNS, freePorts, freshData, startServer, versions } from './servers.mjs'
import { Twin, VARIANTS } from './twin.mjs'
import { openDoor } from './door.mjs'
import { textDiff } from './diff.mjs'
import { mutantSpec } from '../mutants.mjs'

const specs = new Map()
export function spec(name) {
  if (!specs.has(name)) {
    if (name.startsWith('mutant:')) specs.set(name, mutantSpec(name.slice(7)))
    else {
      const s = versions()[name]
      if (!s) throw new Error(`no version "${name}" in versions.json`)
      specs.set(name, s)
    }
  }
  return specs.get(name)
}

export async function loadScenarios(want) {
  const dir = path.join(PARITY, 'scenarios')
  const all = []
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const m = await import(path.join(dir, f))
    all.push(...(Array.isArray(m.default) ? m.default : [m.default]))
  }
  return all.filter((s) => !want || want.includes(s.id))
}

// Speed: a scenario is slower on B when its steps took, in all, a quarter longer and 300 ms more than on A. One step
// alone says little (both sides share the machine); the sum over a scenario is steady from run to run.
export function speedOf(steps) {
  const ok = steps.filter((s) => s.kind === 'check' && typeof s.ms?.a === 'number')
  const a = ok.reduce((n, s) => n + s.ms.a, 0)
  const b = ok.reduce((n, s) => n + s.ms.b, 0)
  const worst = ok
    .filter((s) => s.ms.b - s.ms.a > 250)
    .sort((x, y) => y.ms.b - y.ms.a - (x.ms.b - x.ms.a))
    .slice(0, 5)
    .map((s) => ({ i: s.i, label: s.label, a: s.ms.a, b: s.ms.b }))
  return { a, b, slow: b > a * 1.25 + 300, worst }
}

/** -> the report; it is also written to out/<runId>/report.json after every scenario/variant. */
export async function run({ a = 'old', b = 'new', scenarios: want, variants, runId, ports, log = console.log, browser: shared }) {
  runId ||= `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${a}-vs-${b.replace(':', '-')}`
  const OUT = path.join(PARITY, 'out', runId)
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  const [portDoor, portA, portB] = ports || (await freePorts(3))
  const report = {
    run: runId,
    a: { name: a, title: spec(a).title, port: portA },
    b: { name: b, title: spec(b).title, port: portB },
    door: portDoor,
    started: new Date().toISOString(),
    finished: null,
    results: [],
  }
  const save = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  const scenarios = await loadScenarios(want)
  const variantNames = variants || Object.keys(VARIANTS)
  const browser = shared || (await chromium.launch())
  const door = await openDoor(portDoor, { a: portA, b: portB })
  log(`run ${runId}: ${a} vs ${b}, both at ${door.base}; ${scenarios.length} scenarios x ${variantNames.length} variants`)
  try {
    for (const sc of scenarios) {
      for (const vn of variantNames) {
        if (sc.variants && !sc.variants.includes(vn)) continue
        const res = { scenario: sc.id, title: sc.title, variant: vn, steps: [], error: null, data: null, speed: null, ms: 0 }
        report.results.push(res)
        const t0 = Date.now()
        log(`  ${sc.id} / ${vn}`)
        const [rootA, rootB] = [freshData(`${runId}-a`), freshData(`${runId}-b`)]
        const since = Date.now() / 1000
        let sa, sb, twin
        try {
          const up = await Promise.allSettled([
            startServer(spec(a), portA, rootA, path.join(OUT, 'server-a.log')),
            startServer(spec(b), portB, rootB, path.join(OUT, 'server-b.log')),
          ])
          ;[sa, sb] = up.map((x) => x.value)
          for (const x of up) if (x.status === 'rejected') throw x.reason
          twin = new Twin({ browser, door, a: sa, b: sb, variantName: vn, outDir: path.join(OUT, `${sc.id}--${vn}`), log })
          await twin.open()
          await sc.run(twin)
        } catch (e) {
          res.error = String(e.message || e).split('\n')[0]
          log(`    ERROR ${res.error}`)
        } finally {
          res.steps = twin?.steps || []
          await twin?.close()
          await Promise.all([sa?.stop(), sb?.stop()])
        }
        try {
          res.data = JSON.parse(execFileSync('/opt/homebrew/bin/python3', [path.join(PARITY, 'dbdiff.py'), rootA, rootB, String(since)]).toString())
          if (!res.data.same) log(`    DATA differs: ${res.data.diffs.map((d) => d.what).join('; ')}`)
        } catch (e) {
          res.data = { same: false, notes: [`could not compare: ${e.message.split('\n')[0]}`], diffs: [] }
        }
        motionCheck(res)
        res.speed = speedOf(res.steps)
        if (res.speed.slow) log(`    SLOWER on B: ${res.speed.a} ms vs ${res.speed.b} ms`)
        res.ms = Date.now() - t0
        save()
      }
    }
  } finally {
    if (!shared) await browser.close()
    await door.close()
    report.finished = new Date().toISOString()
    save()
    for (const x of ['a', 'b']) fs.rmSync(path.join(RUNS, `${runId}-${x}`), { recursive: true, force: true })
  }
  return report
}

// Motion (animations, transitions) is compared over the whole scenario: the same motions, in any step, count as the
// same (one can start a step later on one side, when an image arrives a moment later). When the scenario's motions
// differ, every step whose motions differ is marked.
export function motionCheck(res) {
  const all = (k) => res.steps.flatMap((s) => s.motion?.[k] || []).sort()
  if (all('a').join('\n') === all('b').join('\n')) return
  for (const s of res.steps) {
    const [a, b] = [s.motion?.a || [], s.motion?.b || []]
    if (a.join('\n') !== b.join('\n')) {
      s.cats.motion = textDiff(a.join('\n'), b.join('\n'))
      s.same = false
    }
  }
}

/** Every difference of a result, as kinds: pixels, url, text, ..., data, speed, error. */
export function kindsOf(res) {
  const k = new Set()
  for (const s of res.steps) for (const c of Object.keys(s.cats || {})) k.add(c)
  if (res.data && !res.data.same) k.add('data')
  if (res.speed?.slow) k.add('speed')
  if (res.error) k.add('error')
  return k
}
