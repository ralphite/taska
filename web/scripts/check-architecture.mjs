// The page's architecture rules that a lint rule cannot say (docs/architecture.md; the import rules are in
// eslint.config.js). Prints each break and exits 1 when there is one.
//
//   node scripts/check-architecture.mjs          check src/
//   node scripts/check-architecture.mjs --self   also plant one break of each rule in a copy and see each is caught

import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAX_LINES = 600

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...files(p))
    else out.push(p)
  }
  return out
}

/** Every break of the rules in the page's source folder. */
export function check(src) {
  const breaks = []
  const all = files(src)
  const rel = (p) => relative(src, p).split(sep).join('/')
  const code = all.filter((p) => /\.(ts|tsx)$/.test(p))
  const say = (p, what) => breaks.push(`${rel(p)}: ${what}`)

  for (const p of all) {
    // one stylesheet: Tailwind and the theme
    if (p.endsWith('.css') && rel(p) !== 'index.css') say(p, 'a stylesheet besides index.css (style with Tailwind classes)')
  }
  for (const p of code) {
    const text = readFileSync(p, 'utf8')
    const r = rel(p)
    const story = r.endsWith('.stories.tsx')
    const lines = text.split('\n').length
    if (lines > MAX_LINES) say(p, `${lines} lines (at most ${MAX_LINES})`)
    if (/<style[\s>]/.test(text)) say(p, 'a <style> element (style with Tailwind classes)')
    const test = /\.test\.tsx?$/.test(r)
    if (!story && !test && !r.startsWith('stories/') && /(?<![\w&])#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')))
      say(p, 'a raw colour (use a Tailwind colour)')
    // no state kept in a module: it belongs to a store made per app, or to a component (a WeakMap memo of a pure
    // function, keyed by the immutable values it reads, keeps nothing that changes what anyone sees)
    if (!story && !test)
      for (const [i, line] of text.split('\n').entries())
        if (/^(export )?(let|var) /.test(line) || /^(export )?const \w+(: [^=]+)? = new (Map|Set|Array)\b/.test(line))
          say(p, `line ${i + 1}: state kept in the module (${line.trim().slice(0, 60)})`)
    if (story) {
      // stories draw components from props; only demos play
      if (/^\s*(play\s*:|async play\s*\()/m.test(text) && !/title:\s*'Demos\//.test(text)) say(p, 'a story that plays outside Demos/')
      if (/from '[./]*(app\/(createApp|context)|pages\/App|main)'/.test(text)) say(p, 'a story that loads the app (feed the component data instead)')
    }
  }
  // a feature is a leaf: it imports no other feature and no page (pages/ puts features together; what they share is
  // in app/, model/ or ui/)
  for (const p of code) {
    const own = /^features\/([^/]+)\//.exec(rel(p))
    if (!own) continue
    for (const [, spec] of readFileSync(p, 'utf8').matchAll(/from '(\.[^']*)'/g)) {
      const to = rel(join(dirname(p), spec))
      const other = /^features\/([^/]+)\//.exec(to)
      if ((other && other[1] !== own[1]) || to.startsWith('pages/')) say(p, `imports ${to} (a feature is a leaf: share through app/, model/ or ui/)`)
    }
  }
  // every presentational component has its stories next to it
  for (const p of code) {
    const r = rel(p)
    if (!/^(features|pages|ui)\//.test(r) || r === 'pages/App.tsx' || !r.endsWith('.tsx') || r.endsWith('.stories.tsx') || r.endsWith('Container.tsx')) continue
    if (!existsSync(p.replace(/\.tsx$/, '.stories.tsx'))) say(p, `no ${basename(p, '.tsx')}.stories.tsx next to it`)
  }
  return breaks
}

/** Each rule, broken once in a copy: the check must catch every one. */
function selfCheck() {
  const tmp = mkdtempSync(join(tmpdir(), 'taska-arch-'))
  try {
    cpSync(join(WEB, 'src'), tmp, { recursive: true })
    const plant = {
      'extra.css': '.x { color: red }\n',
      'features/list/Planted.tsx': 'export const Planted = () => <div style={{ color: "#ff0000" }} />\n',
      'stories/Planted.stories.tsx': "import { App } from '../pages/App'\nexport default { title: 'Components/X' }\nexport const A = {\n  play: async () => {},\n  render: () => <App />,\n}\n",
      'model/planted.ts': 'let count = 0\nexport const seen = new Map()\nexport const up = () => ++count\n',
      'ui/Long.tsx': 'export const Long = () => null\n' + '// filler\n'.repeat(MAX_LINES + 1),
      'features/list/leans.ts': "import { Sidebar } from '../sidebar/Sidebar'\nimport { Header } from '../../pages/Header'\nexport const s = [Sidebar, Header]\n",
    }
    for (const [p, text] of Object.entries(plant)) writeFileSync(join(tmp, p), text)
    const got = check(tmp).join('\n')
    const want = [
      'extra.css: a stylesheet',
      'features/list/Planted.tsx: a raw colour',
      'features/list/Planted.tsx: no Planted.stories.tsx',
      'stories/Planted.stories.tsx: a story that plays',
      'stories/Planted.stories.tsx: a story that loads the app',
      'model/planted.ts: line 1: state kept',
      'model/planted.ts: line 2: state kept',
      'ui/Long.tsx: 603 lines',
      'features/list/leans.ts: imports features/sidebar/Sidebar',
      'features/list/leans.ts: imports pages/Header',
    ]
    const missed = want.filter((w) => !got.includes(w))
    return missed
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const breaks = check(join(WEB, 'src'))
for (const b of breaks) console.log(b)
let failed = breaks.length > 0
if (process.argv.includes('--self')) {
  const missed = selfCheck()
  for (const m of missed) console.log(`self-check: a planted break was not caught: ${m}`)
  failed ||= missed.length > 0
  if (!missed.length) console.log('self-check: every planted break was caught')
}
console.log(failed ? `${breaks.length} break(s) of the architecture rules` : 'architecture rules: ok')
process.exit(failed ? 1 : 0)
