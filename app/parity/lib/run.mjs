// One comparison run: scenarios x variants on two versions, each pair on fresh data, then the report.
import { chromium, webkit } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PARITY, RUNS, freePorts, freshData, releasePorts, startServer, versions } from './servers.mjs'
import { Twin, VARIANTS } from './twin.mjs'
import { openDoor } from './door.mjs'
import { guard } from './guard.mjs'
import { textDiff } from './diff.mjs'
import { mutantSpec } from '../mutants.mjs'

const specs = new Map()
export function spec(name) {
  if (!specs.has(name)) {
    if (name.startsWith('mutant:')) specs.set(name, mutantSpec(name.slice(7)))
    else if (name.startsWith('new@')) {
      // a committed build of the rewrite (tools/build-new.sh <sha>)
      const dir = `/Users/yadong/taska-rewrite/parity/new-builds/${name.slice(4)}/app`
      if (!fs.existsSync(`${dir}/web/dist/index.html`)) throw new Error(`no build of ${name}: run tools/build-new.sh ${name.slice(4)}`)
      const n = versions().new
      specs.set(name, { ...n, title: `新版 ${name.slice(4)}`, cwd: `${dir}/server`, env: { ...n.env, TASKA_WEB_DIST: `${dir}/web/dist` } })
    }
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
  // a scenario marked optIn (the long sweeps) runs only when named
  return all.filter((s) => (want ? want.includes(s.id) : !s.optIn))
}

// Speed in a scenario: both sides run at the same moment on a shared, busy machine, so one step can stall for
// seconds on either side. Slower means a pattern: at least two steps clearly slower on B (200 ms and half again),
// and at least two more such steps than the other way round. A single slow step is listed, not counted. (The speed
// scenario times each side alone, three times, and compares the medians.)
export function speedOf(steps) {
  const ok = steps.filter((s) => s.kind === 'check' && !s.untimed && typeof s.ms?.a === 'number')
  const a = ok.reduce((n, s) => n + s.ms.a, 0)
  const b = ok.reduce((n, s) => n + s.ms.b, 0)
  const slower = (x, y) => x - y > Math.max(200, y * 0.5)
  const slowB = ok.filter((s) => slower(s.ms.b, s.ms.a))
  const slowA = ok.filter((s) => slower(s.ms.a, s.ms.b))
  const worst = slowB
    .sort((x, y) => y.ms.b - y.ms.a - (x.ms.b - x.ms.a))
    .slice(0, 5)
    .map((s) => ({ i: s.i, label: s.label, a: s.ms.a, b: s.ms.b }))
  return { a, b, slow: slowB.length >= 2 && slowB.length >= slowA.length + 2, worst, slowA: slowA.length, slowB: slowB.length }
}

// Yadong's own Taska (and its tunnel) runs on this machine: the machine guard decides when pages may open
// (lib/guard.mjs). Between steps a run asks it for no pages, which only waits while the machine is held.
export async function quietMachine(log = () => {}) {
  guard(0, log)
}
export async function notBusy(log = () => {}) {
  guard(0, log)
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
  await quietMachine(log)
  const browser = shared || (await chromium.launch())
  let wk = null // Safari's engine, started when an iphone variant first needs it
  const door = await openDoor(portDoor, { a: portA, b: portB })
  log(`run ${runId}: ${a} vs ${b}, both at ${door.base}; ${scenarios.length} scenarios x ${variantNames.length} variants`)
  try {
    for (const sc of scenarios) {
      for (const vn of variantNames) {
        if (sc.variants && !sc.variants.includes(vn)) continue
        await quietMachine(log)
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
          const engine = VARIANTS[vn].engine === 'webkit' ? (wk ||= await webkit.launch()) : browser
          twin = new Twin({ browser: engine, door, a: sa, b: sb, variantName: vn, outDir: path.join(OUT, `${sc.id}--${vn}`), log })
          twin.beforeStep = () => notBusy(log)
          await twin.open()
          // long runs (the sweeps) are written as they go, every 25 steps, to be read before they end
          twin.onRecord = () => {
            if (twin.steps.length % 25) return
            res.steps = twin.steps
            save()
          }
          twin.untimed = !!sc.untimed // retries and timers decide how long its steps take: not a measure of speed
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
        errorsCheck(res)
        res.speed = speedOf(res.steps)
        if (res.speed.slow) log(`    SLOWER on B: ${res.speed.a} ms vs ${res.speed.b} ms`)
        res.ms = Date.now() - t0
        save()
      }
    }
  } finally {
    if (!shared) await browser.close()
    await wk?.close()
    await door.close()
    report.finished = new Date().toISOString()
    save()
    for (const x of ['a', 'b']) fs.rmSync(path.join(RUNS, `${runId}-${x}`), { recursive: true, force: true })
    if (!ports) releasePorts([portDoor, portA, portB])
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

// Errors are compared over the scenario too: the same error (the network gone while offline) can come a step
// later on one side. A step keeps its errors difference only for an error the other side never had in the scenario.
export function errorsCheck(res) {
  // a failed answer counts by its status: the page's own API is the rewrite's to shape (its paths differ), the agent
  // interface is compared word for word elsewhere
  const bare = (e) => e.replace(/^HTTP (\d+) \w+ BASE\S*/, 'HTTP $1').replace(/(BASE\/[^\s?]*)\?\S*/g, '$1?…')
  const seenA = new Set(res.steps.flatMap((s) => [...(s.errorsA || []), ...(s.cats?.errors?.a || [])]).map(bare))
  for (const s of res.steps) {
    if (!s.cats?.errors) continue
    if (s.cats.errors.b.every((e) => seenA.has(bare(e)))) {
      delete s.cats.errors
      if (!Object.keys(s.cats).length) s.same = true
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
