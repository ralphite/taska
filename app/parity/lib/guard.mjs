// The machine-wide guard (Yadong's rule, 10-24): all agents together keep at most 5 browser pages open, and heavy
// work waits while the machine is held. Before a run opens pages it asks `machine-guard wait --pages N`, which blocks
// until those pages may open and reserves them for this process; asking for 0 pages only waits out a hold. Our own
// switch out/PARITY_HOLD holds everything too.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PARITY } from './servers.mjs'

const GUARD = path.join(os.homedir(), '.local/bin/machine-guard')
const HOLD = path.join(PARITY, 'out', 'PARITY_HOLD')
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

export function guard(pages, log = () => {}) {
  let said = false
  for (;;) {
    if (fs.existsSync(HOLD)) {
      if (!said) log('    held: out/PARITY_HOLD')
      said = true
      sleepSync(15000)
      continue
    }
    try {
      execFileSync(GUARD, ['wait', '--pages', String(pages), '--timeout', '600', '--owner', String(process.pid)], { stdio: 'ignore' })
      return
    } catch (e) {
      if (e.status !== 3) throw new Error(`machine-guard failed: ${e.message.split('\n')[0]}`)
      if (!said) log(`    waiting for the machine guard (${pages} pages)`)
      said = true
    }
  }
}
