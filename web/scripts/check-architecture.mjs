// The page's architecture rules that a lint rule cannot say (docs/architecture.md; the import rules are in
// eslint.config.js), and that every component the page draws is drawn by a story (scripts/story-coverage.mjs).
// Prints each break and exits 1 when there is one.
//
//   node scripts/check-architecture.mjs          check src/
//   node scripts/check-architecture.mjs --self   also plant one break of each rule in a copy and see each is caught

import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readAllow, storyCoverage } from './story-coverage.mjs'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAX_LINES = 600
// the one file that loads the whole app for a story: a Demo's frame (T589)
const DEMO_PAGE = 'stories/demo/DemoPage.tsx'

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...files(p))
    else out.push(p)
  }
  return out
}

/** Every break of the rules in the page's source folder; `allow`: the components that need no story. */
export function check(src, allow = readAllow(WEB)) {
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
    if (lines > MAX_LINES && !r.endsWith('.gen.ts')) say(p, `${lines} lines (at most ${MAX_LINES})`) // a generated file (*.gen.ts) is its tool's
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
      // stories draw components from props; only Demos play
      const demo = /title:\s*'Demo\//.test(text)
      if (/^\s*(play\s*:|async play\s*\()/m.test(text) && !demo) say(p, 'a story that plays outside Demo/')
      if (/from '[./]*(app\/(createApp|context)|pages\/App|main)'/.test(text)) say(p, 'a story that loads the app (feed the component data instead)')
      // Play (a Demo pressing for you) only in Demo/ (T589)
      if (/from '[./]*(stories\/)?(demo\/)?DemoFrames'/.test(text) && !demo) say(p, 'Play outside Demo/ (only a Demo plays itself)')
    }
    // a Demo's frame (T589): the one place the whole app is loaded for a story, its network the replay and every
    // other way out closed; nothing in a Demo makes a request of its own
    if (r.startsWith('stories/') && !story && /^import (?!type )[^\n]*from '[./]*(app\/createApp|pages\/App|main)'/m.test(text)) {
      if (r !== DEMO_PAGE) say(p, "a story that loads the app (only a Demo's frame does: stories/demo/DemoPage.tsx)")
      else if (!/\blockNetwork\(/.test(text) || !/createApp\(frameEnv\(/.test(text)) say(p, 'loads the app without closing its network (lockNetwork, frameEnv)')
    }
    if (r.startsWith('stories/demo/') && !test && /(?<![\w.])fetch\(|\.fetch\(|new (XMLHttpRequest|WebSocket|EventSource)\b|sendBeacon\(/.test(text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')))
      say(p, 'a request out of a Demo (its page is answered by the replay only)')
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
    if (!/^(features|pages|ui)\//.test(r) || r === 'pages/App.tsx' || !r.endsWith('.tsx') || r.endsWith('.stories.tsx') || r.endsWith('.test.tsx') || r.endsWith('Container.tsx')) continue
    if (!existsSync(p.replace(/\.tsx$/, '.stories.tsx'))) say(p, `no ${basename(p, '.tsx')}.stories.tsx next to it`)
  }
  // every component the page draws is drawn by a story, directly or through what the story renders
  breaks.push(...storyCoverage(src, allow))
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
      'features/list/PlantedContainer.tsx': "import { Planted } from './Planted'\nexport function PlantedContainer() {\n  return <Planted />\n}\n",
      'stories/Planted.stories.tsx': "import { App } from '../pages/App'\nexport default { title: 'Components/X' }\nexport const A = {\n  play: async () => {},\n  render: () => <App />,\n}\n",
      'model/planted.ts': 'let count = 0\nexport const seen = new Map()\nexport const up = () => ++count\n',
      'ui/Long.tsx': 'export const Long = () => null\n' + '// filler\n'.repeat(MAX_LINES + 1),
      'features/list/leans.ts': "import { Sidebar } from '../sidebar/Sidebar'\nimport { Header } from '../../pages/Header'\nexport const s = [Sidebar, Header]\n",
      'stories/demo/Leaky.tsx': "import { App } from '../../pages/App'\nexport const L = () => (void fetch('/api/projects'), <App />)\n",
      'stories/PlaysAlone.stories.tsx': "import { DemoFrames } from './demo/DemoFrames'\nexport default { title: 'UI/X' }\nexport const A = { render: () => <DemoFrames demo={null as never} theme=\"light\" /> }\n",
      [DEMO_PAGE]: readFileSync(join(tmp, DEMO_PAGE), 'utf8').replace(/\blockNetwork\(w\)/, 'void w'),
    }
    for (const [p, text] of Object.entries(plant)) writeFileSync(join(tmp, p), text)
    const allow = 'ui/Gone.tsx#Gone: planted\nui/Icon.tsx#Icon: planted\nui/Grip.tsx#Grip\n'
    const got = check(tmp, allow).join('\n')
    const want = [
      'extra.css: a stylesheet',
      'features/list/Planted.tsx: a raw colour',
      'features/list/Planted.tsx: no Planted.stories.tsx',
      'stories/Planted.stories.tsx: a story that plays outside Demo/',
      'stories/Planted.stories.tsx: a story that loads the app',
      'model/planted.ts: line 1: state kept',
      'model/planted.ts: line 2: state kept',
      'ui/Long.tsx: 603 lines',
      'features/list/leans.ts: imports features/sidebar/Sidebar',
      'features/list/leans.ts: imports pages/Header',
      'features/list/Planted.tsx: Planted is drawn by no story',
      'features/list/PlantedContainer.tsx: PlantedContainer is drawn by no story (a container: it renders features/list/Planted.tsx#Planted',
      'no-story.txt line 1: ui/Gone.tsx#Gone is not a component any more',
      'no-story.txt line 2: ui/Icon.tsx#Icon has a story now',
      'no-story.txt line 3: write it as',
      "stories/demo/Leaky.tsx: a story that loads the app (only a Demo's frame",
      'stories/demo/Leaky.tsx: a request out of a Demo',
      'stories/PlaysAlone.stories.tsx: Play outside Demo/',
      `${DEMO_PAGE}: loads the app without closing its network`,
    ]
    const missed = want.filter((w) => !got.includes(w))
    // a story that renders the new component covers it, and its container with it
    writeFileSync(join(tmp, 'features/list/Planted.stories.tsx'), "import { Planted } from './Planted'\nexport default { title: 'Components/X' }\nexport const A = { render: () => <Planted /> }\n")
    const after = storyCoverage(tmp, '').filter((b) => b.includes('Planted'))
    missed.push(...after.map((b) => `a story renders it now, yet: ${b}`))
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
