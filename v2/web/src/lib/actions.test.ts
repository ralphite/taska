import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// B445: a button whose action has no handler does nothing when tapped ("Show N earlier" lost its handler once)
describe('every data-act on the page', () => {
  it('has a handler', () => {
    const src = resolve(process.cwd(), 'src')
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : /\.tsx?$/.test(e.name) && !/\.(test|stories)\./.test(e.name)
            ? [join(dir, e.name)]
            : [],
      )
    const all = files(src).map((f) => readFileSync(f, 'utf8'))
    const acts = new Set(all.flatMap((s) => [...s.matchAll(/data-act[=:]\s*["']([\w-]+)["']/g)].map((m) => m[1])))
    const lib = files(join(src, 'lib'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
    const handled = (a: string) =>
      new RegExp(`^\\s*'?${a}'?:\\s*(async\\s*)?\\(`, 'm').test(lib) || lib.includes(`'${a}'`) || lib.includes(`"${a}"`)
    expect([...acts].filter((a) => !handled(a))).toEqual([])
  })
})
