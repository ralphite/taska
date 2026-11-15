// F25 (D136 C533): the app's own words (labels, buttons, states, hints) are English; what the user writes, and what
// the organizer writes from it, stays in the user's language. So the page's code holds no Chinese: Chinese reaches the
// page only as the user's data. Stories and test data may hold what a user says.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const SRC = __dirname
const DATA = /\.test\.|stories|[Ff]ixture/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (DATA.test(p)) return []
    if (statSync(p).isDirectory()) return files(p)
    return /\.tsx?$/.test(name) ? [p] : []
  })
}

test("the app's own words are English", () => {
  const chinese: string[] = []
  for (const f of files(SRC))
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/[一-鿿]/.test(line)) chinese.push(`${f.slice(SRC.length + 1)}:${i + 1}: ${line.trim().slice(0, 100)}`)
      })
  expect(chinese).toEqual([])
})
