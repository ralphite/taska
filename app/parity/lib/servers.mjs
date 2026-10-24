// Starts a Taska version on a port, on a fresh copy of the data snapshot, and stops it again.
// A port someone else holds is never taken over: the start fails and says so.
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const PARITY = path.dirname(HERE)
export const RUNS = '/Users/yadong/taska-rewrite/parity/runs'
const KEY_VARS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY']

export function versions() {
  return JSON.parse(fs.readFileSync(path.join(PARITY, 'versions.json'), 'utf8'))
}

const portBusy = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' })
    s.once('connect', () => (s.destroy(), resolve(true)))
    s.once('error', () => resolve(false))
  })

/** n free ports from the parity range (7450-7479), held for this process (a lock file with its pid), so two runs at
 * once never pick the same; ports others listen on are skipped. */
export async function freePorts(n, from = 7450, to = 7479) {
  const dir = path.join(RUNS, '.ports')
  fs.mkdirSync(dir, { recursive: true })
  const alive = (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  const out = []
  for (let p = from; p <= to && out.length < n; p++) {
    const lock = path.join(dir, String(p))
    let holder = 0
    try {
      holder = Number(fs.readFileSync(lock, 'utf8'))
    } catch {}
    if (holder && holder !== process.pid && alive(holder)) continue
    if (await portBusy(p)) continue
    fs.writeFileSync(lock, String(process.pid))
    out.push(p)
  }
  if (out.length < n) throw new Error(`no ${n} free ports in ${from}-${to}`)
  return out
}

async function waitUp(base, ms = 90000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const r = await fetch(base + '/health')
      if (r.status === 200) return
    } catch {}
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`${base} did not answer /health within ${ms / 1000}s`)
}

/** A fresh copy of the snapshot in RUNS/<name>/data (an older copy of that name is removed first). The server gets
 * RUNS/<name> as its home folder, so the page shows the data folder as ~/data on both sides (Settings > Projects
 * shows each project's database path). */
export function freshData(name, src) {
  fs.rmSync(path.join(RUNS, name), { recursive: true, force: true })
  const dst = path.join(RUNS, name, 'data')
  const args = [path.join(PARITY, 'data.py'), dst]
  if (src) args.push(src)
  execFileSync('/opt/homebrew/bin/python3', args, { stdio: 'inherit' })
  return dst
}

export async function startServer(spec, port, root, logFile) {
  if (!spec.cmd) throw new Error(`no start command for this version yet (versions.json)`)
  if (await portBusy(port)) throw new Error(`port ${port} is in use by another program; parity does not take it over`)
  const env = { ...process.env, ...(spec.env || {}), PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
  for (const k of KEY_VARS) delete env[k]
  if (path.basename(root) === 'data' && root.startsWith(RUNS)) env.HOME = path.dirname(root) // see freshData
  const cmd = spec.cmd.map((x) => x.replace('{port}', String(port)).replace('{root}', root))
  const log = fs.openSync(logFile, 'a')
  const proc = spawn(cmd[0], cmd.slice(1), { cwd: spec.cwd || undefined, env, stdio: ['ignore', log, log], detached: true })
  const base = `http://127.0.0.1:${port}`
  try {
    await waitUp(base)
  } catch (e) {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {}
    throw new Error(`${e.message}; log: ${logFile}`)
  }
  const srv = {
    base,
    port,
    root,
    /** Again on the same port and data, after stop(). */
    restart: async () => {
      const again = await startServer(spec, port, root, logFile)
      Object.assign(srv, { stop: again.stop, restart: again.restart })
    },
    stop: async () => {
      try {
        process.kill(-proc.pid, 'SIGTERM')
      } catch {}
      const end = Date.now() + 8000
      while (Date.now() < end && (await portBusy(port))) await new Promise((r) => setTimeout(r, 100))
      if (await portBusy(port))
        try {
          process.kill(-proc.pid, 'SIGKILL')
        } catch {}
      fs.closeSync(log)
    },
  }
  return srv
}
