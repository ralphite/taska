// What Yadong said to remove stays removed (T689, r1092): "UI that is not in the product cannot be in a story", and
// what he does not need is deleted, not hidden. Each entry is his decision and the words or names that would show it
// came back; any line of the page, its stories or the server holding them fails this test (a comment that cites the
// decision, rNNN or an item code, is fine). Add an entry with every such decision; remove one only on his explicit word.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const REMOVED: { why: string; gone: RegExp }[] = [
  { why: 'r583, r1092: no "New input · organizer files it" line over the box', gone: /(organizer|agent) files it/ },
  { why: 'T689: no "Pick an item or type below" pane; nothing open on the desktop is the New input page', gone: /Pick an item or type below/ },
  { why: 'r514, r520: no new-rule input mode or draft', gone: /a new rule\b|\/new-rule/ },
  { why: 'r655, r745: the phone list head has no search field; Search opens the search page', gone: /Search items/ },
  { why: 'r1084: an input has no Queued state', gone: /['"`]Queued['"`]|Waiting to be organized/ },
  { why: 'r1080: no "Speak or write about it" beside a place\'s two buttons', gone: /Speak or write about it/ },
  { why: 'r437: no "New input instead" / "Add to … instead" on the New input page', gone: /New input instead|Add to \S+ instead/ },
]

const ROOT = join(__dirname, '..', '..')
const DIRS = ['web/src', 'web/.storybook', 'server/taska']
const SKIP = /node_modules|\.test\.|removed\.test/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (SKIP.test(p)) return []
    if (statSync(p).isDirectory()) return files(p)
    return /\.(tsx?|py|json)$/.test(name) ? [p] : []
  })
}

test('what Yadong removed is not back', () => {
  const back: string[] = []
  for (const f of DIRS.flatMap((d) => files(join(ROOT, d))))
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/\b(r|[A-Z])\d{3,}\b/.test(line)) return // a comment saying it was removed, and why (rNNN, B684)
        for (const r of REMOVED) if (r.gone.test(line)) back.push(`${f.slice(ROOT.length + 1)}:${i + 1} (${r.why}): ${line.trim().slice(0, 120)}`)
      })
  expect(back).toEqual([])
})
