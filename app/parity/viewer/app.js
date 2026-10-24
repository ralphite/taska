// The parity page: overview (the tool's own check, the runs), one run's report, and old/new side by side.
const $main = document.getElementById('main')
// the same host the page came from: on the phone (through Local Hub's LAN forwarding) that is the Mac, not the phone
const OLD = `${location.protocol}//${location.hostname}:7350`
const NEW = `${location.protocol}//${location.hostname}:7351`
const KIND = {
  pixels: '画面',
  url: '地址',
  title: '标签页标题',
  text: '文字',
  aria: '读屏/按键结构',
  film: '过程中的画面',
  motion: '动效',
  errors: '新报错',
  dialogs: '弹窗',
  action: '操作做不了',
  agent: 'agent 回答',
  data: '数据',
  speed: '速度',
  error: '场景没跑完',
}
// what only a screen reader, or text out of sight, would show: counted, but marked apart from what is seen
const SOFT = new Set(['text', 'aria'])
const tone = (k) => (SOFT.has(k) ? 'warn' : 'bad')
const VAR = { 'desk-light': '电脑 1440 · 浅色', 'desk-dark': '电脑 1440 · 深色', 'phone-light': '手机 393 · 浅色', 'phone-dark': '手机 393 · 深色', 'iphone-light': 'iPhone（Safari 内核）393 · 浅色' }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const chip = (text, tone) =>
  `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
    {
      ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
      bad: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
      dim: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    }[tone]
  }">${esc(text)}</span>`
const card = (inner, extra = '') => `<section class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${extra}">${inner}</section>`
const time = (iso) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—')
const getJSON = (u) => fetch(u, { cache: 'no-store' }).then((r) => r.json())

function kindsOf(res) {
  const k = new Set()
  for (const s of res.steps) for (const c of Object.keys(s.cats || {})) k.add(c)
  if (res.data && !res.data.same) k.add('data')
  if (res.speed?.slow) k.add('speed')
  if (res.error) k.add('error')
  return [...k]
}

// ------------------------------------------------------------------ overview
// findings.md's table: | # | Found in | Where | What differs | Status |
function findingsCard(md) {
  const rows = md
    .split('\n')
    .filter((l) => /^\| P\d+ /.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
  if (!rows.length) return ''
  const open = rows.filter((r) => r[4].startsWith('open')).length
  const md2 = (t) => esc(t).replace(/`([^`]+)`/g, '<code class="rounded bg-zinc-100 px-1 dark:bg-zinc-800">$1</code>')
  return card(`<div class="flex flex-wrap items-center gap-3"><h2 class="text-base font-semibold">差别清单</h2>
    ${open ? chip(`${open} 条还没解决`, 'bad') : chip('全部解决', 'ok')}<span class="text-xs text-zinc-500">每条都人工看过截图确认；编号用来对话</span></div>
    <div class="mt-3 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="text-xs text-zinc-500"><tr>
      <th class="py-1 pr-3 font-medium">#</th><th class="py-1 pr-3 font-medium">发现于</th><th class="py-1 pr-3 font-medium">哪里</th><th class="py-1 pr-3 font-medium">旧版 → 新版</th><th class="py-1 pr-3 font-medium">状态</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr class="border-t border-zinc-100 align-top dark:border-zinc-800"><td class="py-1.5 pr-3 font-mono text-xs">${esc(r[0])}</td>
        <td class="py-1.5 pr-3 font-mono text-xs">${esc(r[1])}</td><td class="py-1.5 pr-3">${md2(r[2])}</td><td class="py-1.5 pr-3">${md2(r[3])}</td>
        <td class="py-1.5 pr-3">${chip(r[4], r[4].startsWith('open') ? 'bad' : 'ok')}</td></tr>`,
      )
      .join('')}</tbody></table></div>`)
}

async function home() {
  const [st, runs, findings] = await Promise.all([getJSON('/api/selftest'), getJSON('/api/runs'), fetch('/api/findings', { cache: 'no-store' }).then((r) => r.text())])
  const muts = Object.entries(st.mutants || {})
  const caught = muts.filter(([, m]) => m.pass).length
  const same = st.same || []
  const trusted = same.length >= 2 && same.every((x) => x.pass) && muts.length && caught === muts.length
  const newRuns = runs.filter((r) => r.b?.name?.startsWith('new'))
  $main.innerHTML = `
  <div class="grid gap-4">
    ${findingsCard(findings)}
    ${card(`
      <div class="flex flex-wrap items-center gap-3"><h2 class="text-base font-semibold">新版和旧版的差别</h2>
      ${newRuns.length ? (newRuns[0].bad ? chip(`最近一次：${newRuns[0].bad} 处场景有差别`, 'bad') : chip('最近一次：没有差别', 'ok')) : chip('新版还没有可比的部分', 'dim')}</div>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">同一份数据（Yadong 数据的快照）、同样的操作，在旧版（快照 1279806）和新版上同时做一遍，比较用户能察觉到的一切：每一步的画面（电脑 1440、手机 393，浅色、深色）、操作过程中出现过的画面、动效、文字、地址、标签页标题、弹窗、报错、agent 接口的回答（逐字）、操作后存下的数据、速度。</p>
      ${runTable(newRuns)}`)}
    ${card(`
      <div class="flex flex-wrap items-center gap-3"><h2 class="text-base font-semibold">这个比对工具可信吗（自检）</h2>
      ${trusted ? chip('可信：旧版比旧版零差异，埋的毛病全抓到', 'ok') : chip('自检还没全部通过', 'warn')}</div>
      <h3 class="mt-4 text-sm font-semibold">1. 旧版比旧版：必须什么都找不到</h3>
      <ul class="mt-2 grid gap-1 text-sm">${
        same.map((x) => `<li class="flex flex-wrap items-center gap-2">${x.pass ? chip('零差异', 'ok') : chip('找到了差别', 'bad')}
          <a class="text-blue-600 hover:underline dark:text-blue-400" href="#/run/${esc(x.run)}">${esc(x.run)}</a>
          <span class="text-zinc-500">${x.runs} 组场景 × 变体，${x.steps} 步 · ${time(x.at)}</span>
          ${x.found.length ? `<span class="text-red-600">${esc(x.found.join('；'))}</span>` : ''}</li>`).join('') || '<li class="text-zinc-500">还没跑</li>'
      }</ul>
      <h3 class="mt-5 text-sm font-semibold">2. 故意埋的毛病：每个都要在该在的地方抓到（${caught}/${muts.length}）</h3>
      <div class="mt-2 overflow-x-auto"><table class="w-full text-left text-sm">
        <thead class="text-xs text-zinc-500"><tr><th class="py-1 pr-3 font-medium">毛病</th><th class="py-1 pr-3 font-medium">应该在</th><th class="py-1 pr-3 font-medium">结果</th></tr></thead>
        <tbody>${muts
          .map(
            ([name, m]) => `<tr class="border-t border-zinc-100 align-top dark:border-zinc-800">
          <td class="py-2 pr-3"><div class="font-medium">${esc(m.title)}</div><div class="text-xs text-zinc-500">${esc(name)}</div></td>
          <td class="py-2 pr-3 text-xs">${esc(m.expect.scenario)} · ${m.expect.variants.map((v) => esc(VAR[v])).join('、')}<br>抓成：${m.expect.cats.map((c) => esc(KIND[c] || c)).join(' 或 ')}${
            m.expect.clean ? `<br>不该出现在：${m.expect.clean.map((v) => esc(VAR[v])).join('、')}` : ''
          }</td>
          <td class="py-2 pr-3"><a href="#/run/${esc(m.run)}" class="inline-flex flex-col items-start gap-1">${m.pass ? chip('抓到了', 'ok') : chip('没抓到', 'bad')}
            ${m.rows.map((r) => `<span class="text-xs text-zinc-500">${esc(VAR[r.variant])}：${r.kinds.map((c) => esc(KIND[c] || c)).join('、') || '无差别'}${r.ok ? '' : ' ✗'}</span>`).join('')}</a></td></tr>`,
          )
          .join('')}</tbody></table></div>`)}
    ${card(`<h2 class="text-base font-semibold">全部比对记录</h2>${runTable(runs)}`)}
  </div>`
}

function runTable(runs) {
  if (!runs.length) return '<p class="mt-3 text-sm text-zinc-500">还没有。</p>'
  return `<div class="mt-3 overflow-x-auto"><table class="w-full text-left text-sm">
    <thead class="text-xs text-zinc-500"><tr><th class="py-1 pr-3 font-medium">记录</th><th class="py-1 pr-3 font-medium">比的是</th><th class="py-1 pr-3 font-medium">开始</th><th class="py-1 pr-3 font-medium">结果</th></tr></thead>
    <tbody>${runs
      .map(
        (r) => `<tr class="border-t border-zinc-100 dark:border-zinc-800">
      <td class="py-1.5 pr-3"><a class="text-blue-600 hover:underline dark:text-blue-400" href="#/run/${esc(r.id)}">${esc(r.id)}</a></td>
      <td class="py-1.5 pr-3 text-zinc-600 dark:text-zinc-400">${esc(r.a?.title)} ↔ ${esc(r.b?.title)}</td>
      <td class="py-1.5 pr-3 text-zinc-500">${time(r.started)}${r.finished ? '' : ' （进行中）'}</td>
      <td class="py-1.5 pr-3">${r.bad ? chip(`${r.bad}/${r.results} 有差别`, 'bad') : chip(`${r.results} 组、${r.steps} 步全一样`, 'ok')}</td></tr>`,
      )
      .join('')}</tbody></table></div>`
}

// ------------------------------------------------------------------ one run
async function runView(id, only) {
  const rep = await getJSON(`/out/${encodeURIComponent(id)}/report.json`)
  const bad = rep.results.filter((r) => kindsOf(r).length)
  const show = only ? bad : rep.results
  $main.innerHTML = `
  <div class="grid gap-4">
    ${card(`<div class="flex flex-wrap items-center gap-3"><h2 class="text-base font-semibold">${esc(rep.run)}</h2>
      ${bad.length ? chip(`${bad.length}/${rep.results.length} 组有差别`, 'bad') : chip(`${rep.results.length} 组全一样`, 'ok')}
      ${rep.finished ? '' : chip('进行中', 'warn')}
      <label class="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" id="only" ${only ? 'checked' : ''}> 只看有差别的</label></div>
      <p class="mt-1 text-sm text-zinc-500">A = ${esc(rep.a.title)}，B = ${esc(rep.b.title)} · ${time(rep.started)} – ${time(rep.finished)}</p>`)}
    ${show.map((r) => resultCard(rep, r, only)).join('') || card('<p class="text-sm text-zinc-500">没有差别。</p>')}
  </div>`
  fillZooms()
  document.getElementById('only').onchange = (e) => (location.hash = `#/run/${id}${e.target.checked ? '?only' : ''}`)
}

function resultCard(rep, r, only) {
  const kinds = kindsOf(r)
  const dir = `/out/${encodeURIComponent(rep.run)}/${encodeURIComponent(`${r.scenario}--${r.variant}`)}`
  const steps = only ? r.steps.filter((s) => !s.same) : r.steps
  return card(`
    <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold">${esc(r.title)}</h3><span class="text-sm text-zinc-500">${esc(r.scenario)} · ${esc(VAR[r.variant] || r.variant)}</span>
      ${kinds.length ? kinds.map((k) => chip(KIND[k] || k, tone(k))).join('') : chip('一样', 'ok')}
      <span class="ml-auto text-xs text-zinc-500">${r.steps.length} 步 · 用时 A ${r.speed?.a ?? '—'} ms / B ${r.speed?.b ?? '—'} ms</span></div>
    ${r.error ? `<p class="mt-2 text-sm text-red-600">场景没跑完：${esc(r.error)}</p>` : ''}
    ${r.data && !r.data.same ? `<div class="mt-3"><div class="text-sm font-medium">数据不同</div>${r.data.diffs.map((d) => `<pre class="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">${esc(d.what)}\n只在 A：${esc((d.only_a || d.a || []).join('\n'))}\n只在 B：${esc((d.only_b || d.b || []).join('\n'))}</pre>`).join('')}</div>` : ''}
    ${r.data?.notes?.length ? `<p class="mt-2 text-xs text-amber-700 dark:text-amber-400">${esc(r.data.notes.join('；'))}</p>` : ''}
    ${r.speed?.slow ? `<p class="mt-2 text-sm text-red-600">B 慢：合计 ${r.speed.b} ms，A ${r.speed.a} ms。最慢的几步：${r.speed.worst.map((w) => `${esc(w.label)}（${w.a}→${w.b} ms）`).join('、')}</p>` : ''}
    <ol class="mt-3 grid gap-2">${steps.map((s) => stepRow(dir, s)).join('')}</ol>`)
}

// The largest differing area, cut from A and from B and enlarged, side by side.
function fillZooms() {
  for (const el of document.querySelectorAll('[data-zoom]')) {
    if (el.dataset.done) continue
    el.dataset.done = '1'
    const z = JSON.parse(el.dataset.zoom)
    for (const [side, src] of [['A', z.a], ['B', z.b]]) {
      const im = new Image()
      im.onload = () => {
        const k = im.naturalWidth > 2000 ? 2 : im.naturalWidth > 1000 ? 3 : 1 // device pixels per CSS pixel
        const pad = 24
        const x = Math.max(0, z.box.x - pad) * k
        const y = Math.max(0, z.box.y - pad) * k
        const w = Math.min(im.naturalWidth - x, (z.box.w + 2 * pad) * k)
        const h = Math.min(im.naturalHeight - y, (z.box.h + 2 * pad) * k)
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        cv.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h)
        cv.className = 'max-w-full rounded border border-zinc-300 dark:border-zinc-700'
        const fig = document.createElement('figure')
        fig.innerHTML = `<figcaption class="mb-1 text-xs text-zinc-500">放大：${side}</figcaption>`
        fig.append(cv)
        if (side === 'A') el.prepend(fig)
        else el.append(fig)
      }
      im.src = src
    }
  }
}

function stepRow(dir, s) {
  const head = `<div class="flex flex-wrap items-center gap-2 text-sm"><span class="w-8 text-right text-xs text-zinc-400">${s.i}</span>
    <span class="${s.same ? '' : 'font-medium'}">${esc(s.label)}</span>
    ${s.same ? '' : Object.keys(s.cats).map((k) => chip(KIND[k] || k, tone(k))).join('')}
    ${s.retries ? chip(`重拍 ${s.retries} 次`, 'dim') : ''}
    <span class="ml-auto text-xs text-zinc-500">${s.kind === 'check' ? `${s.url ? esc(s.url) + ' · ' : ''}A ${s.ms?.a ?? '—'} / B ${s.ms?.b ?? '—'} ms` : s.kind === 'agent' ? `agent 接口 · ${s.ms?.a ?? '—'} / ${s.ms?.b ?? '—'} ms` : s.kind === 'timed' ? `单独计时，各 ${s.all?.a?.length} 次的中位数：A ${s.ms.a} / B ${s.ms.b} ms` : ''}</span></div>`
  if (s.same) {
    return `<li class="rounded-lg border border-zinc-100 px-2 py-1.5 dark:border-zinc-800">${head}${
      s.files?.preview ? `<details class="ml-10"><summary class="cursor-pointer text-xs text-zinc-500">看画面</summary><img loading="lazy" class="mt-2 max-h-96 rounded border border-zinc-200 dark:border-zinc-700" src="${dir}/${s.files.preview}"></details>` : ''
    }</li>`
  }
  const c = s.cats
  const img = (f, cap) => (f ? `<figure class="min-w-0"><figcaption class="mb-1 text-xs text-zinc-500">${cap}</figcaption><a href="${dir}/${f}" target="_blank"><img loading="lazy" class="w-full rounded border border-zinc-200 dark:border-zinc-700" src="${dir}/${f}"></a></figure>` : '')
  const diffText = (rows) => `<pre class="mt-1 max-h-80 overflow-auto rounded bg-zinc-100 p-2 text-xs leading-5 dark:bg-zinc-800">${rows
    .map((d) => `<span class="${d.op === '-' ? 'bg-red-200/70 dark:bg-red-900/60' : d.op === '+' ? 'bg-emerald-200/70 dark:bg-emerald-900/60' : 'text-zinc-500'}">${d.op === '…' ? '…' : esc(d.op + ' ' + d.line)}</span>`)
    .join('\n')}</pre>`
  const film = (side) =>
    (s.film?.[side] || [])
      .map((x) => `<figure class="w-40 shrink-0"><img loading="lazy" class="w-full rounded border ${x.match === undefined && !x.briefly ? 'border-red-500 ring-2 ring-red-500' : 'border-zinc-200 dark:border-zinc-700'}" src="${dir}/${x.file}"><figcaption class="text-xs text-zinc-500">停 ${x.ms} ms</figcaption></figure>`)
      .join('')
  return `<li class="rounded-lg border border-red-200 bg-red-50/40 p-2 dark:border-red-900 dark:bg-red-950/20">${head}
    <div class="ml-10 mt-2 grid gap-3">
      ${s.files?.a ? `<div class="grid grid-cols-1 gap-2 md:grid-cols-3">${img(s.files.a, 'A 旧版')}${img(s.files.b, 'B')}${img(s.files.diff, '不同的地方（红）')}</div>` : ''}
      ${c.pixels ? `<p class="text-xs text-zinc-500">${c.pixels.n} 个像素不同${c.pixels.size ? '（画面大小都不一样）' : ''}；位置：${c.pixels.boxes.map((b) => `(${b.x},${b.y}) ${b.w}×${b.h}`).join('、')}</p>
        ${c.pixels.boxes.length && !c.pixels.size ? `<div class="flex flex-wrap gap-3" data-zoom='${esc(JSON.stringify({ a: `${dir}/${s.files.a}`, b: `${dir}/${s.files.b}`, box: c.pixels.boxes[0] }))}'></div>` : ''}` : ''}
      ${c.url ? `<p class="text-sm">地址：A <code>${esc(c.url[0])}</code> · B <code>${esc(c.url[1])}</code></p>` : ''}
      ${c.title ? `<p class="text-sm">标签页标题：A “${esc(c.title[0])}” · B “${esc(c.title[1])}”</p>` : ''}
      ${c.text ? `<div><div class="text-sm font-medium">文字（含要滚动才看到的）</div>${diffText(c.text)}</div>` : ''}
      ${c.aria ? `<div><div class="text-sm font-medium">读屏/按键看到的结构</div>${diffText(c.aria)}</div>` : ''}
      ${c.motion ? `<div><div class="text-sm font-medium">动效（动画和过渡）</div>${diffText(c.motion)}</div>` : ''}
      ${c.film ? `<div><div class="text-sm font-medium">过程中的画面：${esc(c.film.join('；'))}</div>
        <div class="mt-1 text-xs text-zinc-500">A</div><div class="flex gap-2 overflow-x-auto">${film('a')}</div>
        <div class="mt-1 text-xs text-zinc-500">B</div><div class="flex gap-2 overflow-x-auto">${film('b')}</div></div>` : ''}
      ${c.agent ? `<div><div class="text-sm font-medium">agent 回答${c.agent.status[0] !== c.agent.status[1] ? `（状态码 ${c.agent.status.join(' / ')}）` : ''}</div>${diffText(c.agent.diff)}</div>` : ''}
      ${c.errors ? `<div class="text-sm">B 的新报错：<pre class="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">${esc(c.errors.b.filter((e) => !c.errors.a.includes(e)).join('\n'))}</pre></div>` : ''}
      ${c.dialogs ? `<p class="text-sm">弹窗：A ${esc(JSON.stringify(c.dialogs[0]))} · B ${esc(JSON.stringify(c.dialogs[1]))}</p>` : ''}
      ${c.action ? `<p class="text-sm text-red-600">这一步在 B 上做不了：${esc(c.action[1])}</p>` : ''}
      ${c.speed ? `<p class="text-sm text-red-600">B 慢：中位数 ${c.speed.b} ms，A ${c.speed.a} ms（每次：A ${c.speed.all.a.join(' / ')}，B ${c.speed.all.b.join(' / ')}）</p>` : ''}
    </div></li>`
}

// ------------------------------------------------------------------ old and new side by side
function live() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  const path = q.get('path') || '/p/taska/'
  const size = q.get('size') || 'phone'
  const [w, h] = size === 'phone' ? [393, 852] : [1440, 900]
  const avail = Math.min(1, (document.body.clientWidth - 48) / 2 / w)
  const frame = (base, title) => `<div class="min-w-0"><div class="mb-1 flex items-center gap-2 text-sm"><span class="font-semibold">${title}</span>
      <a class="text-xs text-blue-600 hover:underline dark:text-blue-400" target="_blank" href="${base}${esc(path)}">${base}${esc(path)} ↗</a></div>
    <div class="overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700" style="width:${Math.floor(w * avail)}px;height:${Math.floor(h * avail)}px">
      <iframe src="${base}${esc(path)}" style="width:${w}px;height:${h}px;transform:scale(${avail});transform-origin:0 0" class="border-0 bg-white"></iframe></div></div>`
  $main.innerHTML = `<div class="grid gap-4">
    ${card(`<form id="lf" class="flex flex-wrap items-center gap-3 text-sm">
      <label class="flex items-center gap-2">地址 <input name="path" value="${esc(path)}" class="w-64 rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-700 dark:bg-zinc-800"></label>
      <label class="flex items-center gap-2"><input type="radio" name="size" value="phone" ${size === 'phone' ? 'checked' : ''}> 手机 393×852</label>
      <label class="flex items-center gap-2"><input type="radio" name="size" value="desk" ${size === 'desk' ? 'checked' : ''}> 电脑 1440×900</label>
      <button class="rounded-md bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900">两边一起打开</button>
      <span class="text-xs text-zinc-500">旧版在 7350，新版在 7351。两边各点各的；深浅色跟着电脑的设置。</span></form>`)}
    <div class="flex flex-wrap gap-4">${frame(OLD, '旧版（快照 1279806）')}${frame(NEW, '新版')}</div></div>`
  document.getElementById('lf').onsubmit = (e) => {
    e.preventDefault()
    const f = new FormData(e.target)
    location.hash = `#/live?path=${encodeURIComponent(f.get('path'))}&size=${f.get('size')}`
  }
}

// ------------------------------------------------------------------ routing
async function route() {
  const h = location.hash || '#/'
  const tab = h.startsWith('#/live') ? 'live' : 'home'
  for (const a of document.querySelectorAll('#nav a'))
    a.className = `rounded-md px-3 py-1.5 ${a.dataset.tab === tab ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`
  try {
    if (h.startsWith('#/run/')) {
      const [id, qs] = h.slice(6).split('?')
      await runView(decodeURIComponent(id), qs === 'only' || qs === undefined)
    } else if (tab === 'live') live()
    else await home()
  } catch (e) {
    $main.innerHTML = card(`<p class="text-sm text-red-600">打不开：${esc(e.message)}</p>`)
  }
  document.getElementById('stamp').textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
}
addEventListener('hashchange', route)
route()
