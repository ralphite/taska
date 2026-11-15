// B746 (D136 C486): a project's picture never takes the place of Taska's own favicon: the tab's icon is index.html's,
// and no code of the page touches the page's icon links.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (/\.test\.|stories/.test(p)) return []
    if (statSync(p).isDirectory()) return files(p)
    return /\.tsx?$/.test(name) ? [p] : []
  })
}

test("Taska's tab keeps its own icon", () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8')
  expect(html).toMatch(/<link rel="icon" href="data:image\/svg\+xml,[^"]*%232563eb/)
  const touching = files(__dirname).filter((f) => /rel=["']?(shortcut )?icon|link\[rel|rel\s*=\s*['"](shortcut )?icon|\.rel = ['"]icon/.test(readFileSync(f, 'utf8')))
  expect(touching).toEqual([])
})
