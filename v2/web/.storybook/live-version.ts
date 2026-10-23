// B537: Storybook draws the code as it is now (main's working tree), while live Taska runs the code of its last ship,
// so the two can differ (new icons here, old ones in the app). GET /taska-live.json tells the Storybook page how far
// live Taska is behind: the commits between the one the last ship put live (refs/taska/shipped, written by ship.sh
// through ship_checks.py --shipped) and HEAD. {"behind": null} when that cannot be told.
import { execFile } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
let cached: { at: number; behind: number | null } = { at: 0, behind: null }

function behind(): Promise<number | null> {
  return new Promise((done) =>
    execFile(
      'git',
      ['rev-list', '--count', 'refs/taska/shipped..HEAD'],
      { cwd: ROOT, timeout: 10_000, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } },
      (err, out) => done(err ? null : Number(out.trim())),
    ),
  )
}

type App = { get(path: string, handler: (req: IncomingMessage, res: ServerResponse) => void): unknown }

export function liveVersionRoute<T extends App>(app: T): T {
  app.get('/taska-live.json', async (_req, res) => {
    if (Date.now() - cached.at > 30_000) cached = { at: Date.now(), behind: await behind() }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify({ behind: cached.behind }))
  })
  return app
}
