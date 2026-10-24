// Planted faults: copies of the old snapshot with one small change each, the kind of mistake a rewrite makes.
// The tool is trusted only when old-vs-old finds nothing and old-vs-mutant finds each of these, where expected.
//
// A patch replaces text in a file of the copy (paths under v2/); the text must be found exactly `count` times
// (default 1), so a patch that no longer applies fails loudly instead of planting nothing.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = '/Users/yadong/taska-rewrite/baseline'
const HOME = '/Users/yadong/taska-rewrite/parity/mutants'
const CSS = 'web/dist/assets/index-CnexQd2l.css'
const JS = 'web/dist/assets/index-DGrVmhVf.js'

const SW = 'web/dist/assets/switch-CV3DLf5x.js'
const HTML = 'web/dist/index.html'
const WEB = 'server/taska/web.py'

// expect: where it must be found: scenario, variants, and which kind of difference (any of `cats`); `clean` lists
// variants where it must NOT be found (a dark-only fault must leave light alone).
export const MUTANTS = [
  {
    name: 'shade',
    title: '黄色徽章深了一档（amber-100 用成 amber-200 的亮度）',
    patches: [{ file: CSS, find: '--color-amber-100:oklch(96.2% .059 95.617);', replace: '--color-amber-100:oklch(92.4% .12 95.746);' }],
    expect: { scenario: 'home', variants: ['desk-light', 'phone-light', 'iphone-light'], cats: ['pixels'] },
  },
  {
    name: 'nudge',
    title: '手机顶栏往下挪了 1 像素（只在手机宽度）',
    patches: [{ file: CSS, find: '/*! tailwindcss', replace: '@media (max-width:63.99rem){header{margin-top:1px}}/*! tailwindcss' }],
    expect: { scenario: 'list', variants: ['phone-light'], cats: ['pixels'], clean: ['desk-light'] },
  },
  {
    name: 'word',
    title: '首页 “New project” 写成 “New Project”',
    patches: [{ file: JS, find: '{d:`M12 5v14`})]}),`New project`]', replace: '{d:`M12 5v14`})]}),`New Project`]' }],
    expect: { scenario: 'home', variants: ['desk-light'], cats: ['pixels', 'text'] },
  },
  {
    name: 'dark',
    title: '深色背景用错一档（zinc-950 成了 zinc-900，只影响深色）',
    patches: [
      { file: CSS, find: '.dark\\:bg-zinc-950:where([data-theme=dark],[data-theme=dark] *){background-color:var(--color-zinc-950)}', replace: '.dark\\:bg-zinc-950:where([data-theme=dark],[data-theme=dark] *){background-color:var(--color-zinc-900)}' },
      { file: CSS, find: '.dark\\:bg-zinc-950:where(:not([data-theme=light],[data-theme=light] *)){background-color:var(--color-zinc-950)}', replace: '.dark\\:bg-zinc-950:where(:not([data-theme=light],[data-theme=light] *)){background-color:var(--color-zinc-900)}' },
    ],
    expect: { scenario: 'home', variants: ['desk-dark'], cats: ['pixels'], clean: ['desk-light'] },
  },
  {
    name: 'hover',
    title: '侧栏指着时的底色深了（只在鼠标指着时看得到）',
    patches: [{ file: CSS, find: '.hover\\:bg-zinc-200\\/60:hover{background-color:color-mix(in oklab, var(--color-zinc-200) 60%, transparent)}', replace: '.hover\\:bg-zinc-200\\/60:hover{background-color:color-mix(in oklab, var(--color-zinc-300) 60%, transparent)}' }],
    expect: { scenario: 'sidebar', variants: ['desk-light'], cats: ['pixels'], step: '指着' },
  },
  {
    name: 'address',
    title: '搜索写进地址时用 ?query= 而不是 ?q=（画面一样，只有地址不同）',
    patches: [{ file: SW, find: 'w.q&&e.set(`q`,w.q)', replace: 'w.q&&e.set(`query`,w.q)' }],
    expect: { scenario: 'list', variants: ['desk-light'], cats: ['url'] },
  },
  {
    name: 'tab-title',
    title: '浏览器标签页标题的分隔符变了（· 成了 -）',
    patches: [{ file: JS, find: '${Ot()} · Taska', replace: '${Ot()} - Taska' }],
    expect: { scenario: 'sidebar', variants: ['desk-light'], cats: ['title'] },
  },
  {
    name: 'offline-words',
    title: '断网时的提示字改了（Waiting for Taska 成了 Waiting on Taska）',
    patches: [{ file: JS, find: 'children:[`Waiting for Taska`,t,', replace: 'children:[`Waiting on Taska`,t,' }],
    expect: { scenario: 'offline-send', variants: ['phone-light'], cats: ['pixels', 'text'] },
  },
  {
    name: 'flash',
    title: '提示条出现时先红 0.45 秒（最后的画面一样，只有过程不同）',
    patches: [{ file: CSS, find: '/*! tailwindcss', replace: '[role=status]{animation:parityflash .45s steps(1)}@keyframes parityflash{0%{background-color:#dc2626}}/*! tailwindcss' }],
    expect: { scenario: 'approve', variants: ['desk-light'], cats: ['motion'] },
  },
  {
    name: 'fade',
    title: '提示条多了 0.3 秒淡入（只有动效不同）',
    patches: [{ file: CSS, find: '/*! tailwindcss', replace: '[role=status]{animation:parityfade .3s ease-out}@keyframes parityfade{from{opacity:0}}/*! tailwindcss' }],
    expect: { scenario: 'approve', variants: ['desk-light'], cats: ['motion'] },
  },
  {
    name: 'page-error',
    title: '每次点击都在控制台报一个错（画面不变）',
    patches: [{ file: HTML, find: '</head>', replace: "<script>addEventListener('click',()=>console.error('parity mutant: an error on click'))</script></head>" }],
    expect: { scenario: 'home', variants: ['desk-light'], cats: ['errors'] },
  },
  {
    name: 'agent-guide',
    title: 'agent 说明里少了一个词（the inbox first 成了 inbox first）',
    patches: [{ file: 'server/taska/guide.py', find: 'what to do now: the inbox first', replace: 'what to do now: inbox first' }],
    expect: { scenario: 'agent-api', variants: ['desk-light'], cats: ['agent'] },
  },
  {
    name: 'who',
    title: '页面上的改动记成 organizer 做的（数据不同）',
    patches: [{ file: WEB, find: 'lines, _ = s.run_all(ops, "you")', replace: 'lines, _ = s.run_all(ops, "org")' }],
    expect: { scenario: 'approve', variants: ['desk-light'], cats: ['data'] },
  },
  {
    name: 'not-live',
    title: 'agent 写入后页面不自己更新（要等 25 秒的轮询）',
    patches: [{ file: WEB, find: 's.cond.wait_for(lambda: s.rev != rev or bool(boot and boot != s.boot) or (pv >= 0 and pv != s.pv), timeout=wait)', replace: 's.cond.wait_for(lambda: bool(boot and boot != s.boot), timeout=wait)' }],
    expect: { scenario: 'agent-live', variants: ['desk-light'], cats: ['pixels', 'text'] },
  },
  {
    name: 'slow',
    title: '页面的每个请求慢 0.4 秒',
    patches: [{ file: WEB, find: '        t0, self.lock_ms, self.status_code = time.monotonic(), 0, 0\n', replace: '        t0, self.lock_ms, self.status_code = time.monotonic(), 0, 0\n        if "/api/" in self.path and "/api/poll" not in self.path:\n            time.sleep(0.4)\n' }],
    expect: { scenario: 'list', variants: ['desk-light'], cats: ['speed'] },
  },
  {
    name: 'slow-save',
    title: '保存慢 0.45 秒（按钮的“处理中”样子多停了一会儿）',
    patches: [{ file: WEB, find: '        elif p == "/api/op":\n', replace: '        elif p == "/api/op":\n            time.sleep(0.45)\n' }],
    expect: { scenario: 'approve', variants: ['desk-light'], cats: ['speed'] },
  },
  {
    name: 'iphone-only',
    title: '只在 iPhone（Safari 内核）上顶栏挪了 1 像素',
    patches: [{ file: CSS, find: '/*! tailwindcss', replace: '@supports (font: -apple-system-body){header{margin-top:1px}}/*! tailwindcss' }],
    expect: { scenario: 'list', variants: ['iphone-light'], cats: ['pixels'], clean: ['phone-light'] },
  },
  {
    name: 'toast-word',
    title: '改优先级后的提示条说 “became P2” 而不是 “is now P2”',
    patches: [{ file: SW, find: 'e===`pri`?`is now ${t}`', replace: 'e===`pri`?`became ${t}`' }],
    // on the desktop the toast is gone after about 1.5 s, before a busy machine has the step's final picture: there it
    // shows in the screens during the step, for a person to judge ('film-note')
    expect: { scenario: 'item-fields', variants: ['desk-light', 'iphone-light'], cats: ['pixels', 'text', 'film-note'] },
  },
  {
    name: 'shortcuts-title',
    title: '快捷键面板标题写成 “Keyboard Shortcuts”',
    patches: [{ file: JS, find: 'return{title:`Keyboard shortcuts`,body:', replace: 'return{title:`Keyboard Shortcuts`,body:' }],
    expect: { scenario: 'keys', variants: ['desk-light'], cats: ['pixels', 'text'] },
  },
  {
    name: 'down-words',
    title: 'Taska 停了时右上角的提示改成 “Offline, trying again…”',
    patches: [{ file: JS, find: '`Offline, retrying…`', replace: '`Offline, trying again…`' }],
    expect: { scenario: 'server-down', variants: ['desk-light', 'phone-light'], cats: ['pixels', 'text'] },
  },
  {
    name: 'file-name',
    title: '上传的文件存成另一个名字（数据和 agent 读到的不同）',
    patches: [{ file: 'server/taska/store.py', find: 'base = re.sub(r"[^\\w.\\-]+", "_", os.path.basename(name or "file"))', replace: 'base = "up-" + re.sub(r"[^\\w.\\-]+", "_", os.path.basename(name or "file"))' }],
    expect: { scenario: 'new-input', variants: ['desk-light'], cats: ['data', 'agent'] },
  },
]

export function mutantSpec(name) {
  const m = MUTANTS.find((x) => x.name === name)
  if (!m) throw new Error(`no mutant "${name}"`)
  const dir = path.join(HOME, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  execFileSync('cp', ['-cR', path.join(BASE, 'v2'), dir])
  for (const p of m.patches) {
    const f = path.join(dir, 'v2', p.file)
    const s = fs.readFileSync(f, 'utf8')
    const n = s.split(p.find).length - 1
    if (n !== (p.count ?? 1)) throw new Error(`mutant ${name}: "${p.find.slice(0, 60)}" found ${n} times in ${p.file}`)
    fs.writeFileSync(f, s.split(p.find).join(p.replace))
  }
  return {
    title: `埋了毛病的旧版：${m.title}`,
    cwd: path.join(dir, 'v2', 'server'),
    cmd: ['/opt/homebrew/bin/python3', '-m', 'taska', 'serve', '--host', '127.0.0.1', '--port', '{port}', '--root', '{root}', '--organizer', 'off'],
    env: { TASKA_WEB_DIST: path.join(dir, 'v2', 'web', 'dist'), PYTHONDONTWRITEBYTECODE: '1' },
  }
}

export { CSS, JS }
