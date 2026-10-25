// Our own switch: while out/PARITY_HOLD exists, every run waits before it opens pages. (There is no machine-wide
// limit on browsers or pause for load: Yadong removed both on 10-24.)
import fs from 'node:fs'
import path from 'node:path'
import { PARITY } from './servers.mjs'

const HOLD = path.join(PARITY, 'out', 'PARITY_HOLD')
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

export function guard(_pages, log = () => {}) {
  let said = false
  while (fs.existsSync(HOLD)) {
    if (!said) log('    held: out/PARITY_HOLD')
    said = true
    sleepSync(15000)
  }
}
