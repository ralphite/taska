// Text the same way everywhere (messages, descriptions, inputs, comments, documents): Markdown with paragraphs, lists,
// quotes, headings, code, tables, links and images; line breaks stay as written. Taska's own parts: choices in a
// question (F56) are buttons you tap, codes (T12, D17, r360, #360) are links with a card (F297), images open the
// viewer, a wide table reads as cards on a phone (T252). Everything is escaped first; DOMPurify checks the result.
// The output is HTML; the buttons in it carry data-act, which actions.ts handles (one listener for the page).
import DOMPurify from 'dompurify'
import { DIMS, wantDims } from './dims'
import { BEHAVIOUR } from './behaviour'
import { ICON, type IconName } from './icons'
import { LETTER as LETTERS, REF_CLS } from './constants'
import {
  U,
  model,
  byN,
  byR,
  code,
  ctx,
  docById,
  esc,
  liveN,
  needsYou,
  plural,
  rcode,
  statusName,
  when,
  whoName,
} from './state'
import type { Item } from './types'

export const ico = (n: IconName | string, c = 'size-5', sw = '1.75') =>
  `<svg class="${c} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n as IconName] ?? ''}</svg>`
export const KBD = (k: string) =>
  `<kbd class="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold opacity-70 ring-1 ring-current/30 lg:inline-grid">${k}</kbd>`

// Pictures shown together, for the viewer's Previous and Next: group id -> file ids
export const groups = new Map<string, string[]>()

export const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
export const CHOICE = /^\s*[-*+]\s+(\(|\[)[ xX]?(\)|\])\s+/
export const hasChoices = (text: unknown) =>
  String(text || '')
    .split('\n')
    .some((l) => CHOICE.test(l))

// F297: a code in the text is a link to what it names, with a card about it on hover. A span, not a button: the text
// can sit inside a tappable card or row.
export function refLink(c: string): string | null {
  if (/^[rR#]\d+$/.test(c)) {
    const r = 'r' + c.slice(1)
    return byR.has(r)
      ? `<span role="link" tabindex="0" data-act="go-input" data-id="${r}" data-ref="${r}" class="${REF_CLS}">${c}</span>`
      : null
  }
  const n = Number(c.slice(1))
  if (c[0] === 'D')
    return docById(n)
      ? `<span role="link" tabindex="0" data-act="docs-go" data-d="${n}" data-ref="${c}" class="${REF_CLS}">${c}</span>`
      : null
  const it = byN.get(n)
  return it && LETTERS[it.type] === c[0]
    ? `<span role="link" tabindex="0" data-act="goto" data-n="${n}" data-ref="${c}" class="${REF_CLS}">${c}</span>`
    : null
}
export const clip = (t: unknown, k: number) => {
  const s = String(t || '')
    .replace(/[#>*`_[\]()!|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > k ? s.slice(0, k) + '…' : s
}
/** What a code's hover card says: kind, state and time on top, the name, then the start of it. */
export function refCard(ref: string) {
  const top = (parts: (string | false | null | undefined)[]) =>
    `<div class="text-[11px] font-medium opacity-70">${parts.filter(Boolean).map(esc).join(' · ')}</div>`
  const name = (t: string) => `<div class="mt-0.5 font-semibold">${esc(t)}</div>`,
    gist = (t: string) => (t ? `<div class="mt-1 line-clamp-4 opacity-80">${esc(t)}</div>` : '')
  if (/^r\d+$/.test(ref)) {
    const r = byR.get(ref)
    if (!r) return ''
    const on = r.scope != null && byN.get(r.scope)
    return (
      top([`Input ${rcode(r.id)}`, r.by === 'you' ? 'You' : whoName(r.by), when(r.t), on && `on ${code(r.scope)}`]) +
      gist(clip(r.text || plural(r.files.length, 'file'), 220))
    )
  }
  if (ref[0] === 'D') {
    const d = docById(Number(ref.slice(1)))
    if (!d) return ''
    const on = byN.get(liveN(d.n))
    return (
      top([`Document ${ref}`, on && `on ${code(on.n)}`, `updated ${when(d.t1 || d.t0)}`]) +
      name(d.title || 'Untitled') +
      gist(
        clip(
          String(d.md || '')
            .split('\n')
            .slice(1)
            .filter((l) => !/^\s*#/.test(l))
            .join(' '),
          200,
        ),
      )
    )
  }
  const it: Item | undefined = byN.get(Number(ref.slice(1)))
  if (!it) return ''
  return (
    top([
      `${it.type[0].toUpperCase() + it.type.slice(1)} ${code(it.n)}`,
      it.pri,
      statusName(it),
      it.archived && 'Archived',
      needsYou(it) && 'Needs you',
    ]) +
    name(it.title) +
    gist(clip(it.body, 200))
  )
}

export function inlineMd(s: string, gid = '', refs = true) {
  const codes: string[] = [],
    links: string[] = [] // `code` and finished links are set aside until the rest is done
  const keep = (html: string) => `\u0001${links.push(html) - 1}\u0001`
  const emph = (t: string) =>
    t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return emph(
    esc(s)
      .replace(/`([^`]+)`/g, (_, c: string) => `\u0000${codes.push(c) - 1}\u0000`)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, src: string) => {
        // ![alt](f12-a.png) for a file uploaded to Taska, or a web address
        if (/^https?:\/\//.test(src))
          return keep(
            `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${alt}" loading="lazy" class="my-1 max-h-96 max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700"></a>`,
          )
        if (gid) {
          if (!groups.has(gid)) groups.set(gid, [])
          groups.get(gid)?.push(src)
        }
        // F353: its size known, the picture's place is kept before it loads (as tall as 24rem at most, as now)
        const wh = DIMS.get(src)
        if (!wh) wantDims()
        const box = wh
          ? ` width="${wh[0]}" height="${wh[1]}" style="aspect-ratio:${wh[0]}/${wh[1]};width:${Math.round(Math.min(wh[0], (384 * wh[0]) / wh[1]))}px"`
          : ''
        return keep(
          `<button data-act="view" data-g="${gid}" data-f="${src}" class="my-1 block max-w-full"><img src="${ctx.P}f/${encodeURIComponent(src)}" alt="${alt}" loading="lazy"${box} class="h-auto max-h-96 max-w-full rounded-lg border border-zinc-200 bg-zinc-100 object-contain dark:border-zinc-700 dark:bg-zinc-800"></button>`,
        )
      })
      // I289: a link to an item or a document (its code, or Taska's own address for it) is the code's chip, opened in
      // Taska; one to another project opens that project here, not as a jump to an absolute address
      .replace(/\[([^\]]+)\]\(([FBITRD]\d{1,5}|r\d{1,6})\)/g, (m, _t: string, c: string) => {
        const l = BEHAVIOUR.docCards && refs && refLink(c)
        return l ? keep(l) : m
      })
      .replace(
        /(\[([^\]]+)\]\()?https?:\/\/[^/\s)]+\/p\/([^/\s)]+)\/([FBITRD]\d{1,5}|r\d{1,6})\/?(\))?/g,
        (m, open: string, t: string, proj: string, c: string, close: string) => {
          if (!BEHAVIOUR.docCards || !!open !== !!close) return m
          const here = decodeURIComponent(proj) === ctx.HERE
          const l = here && refs ? refLink(c) : null
          if (l) return keep(l)
          return keep(
            `<a href="/p/${proj}/${c}" class="text-blue-600 underline underline-offset-2 dark:text-blue-400">${t ? emph(t) : c}</a>`,
          )
        },
      )
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t: string, url: string) =>
        keep(
          `<a href="${url}" target="_blank" rel="noopener" class="text-blue-600 underline underline-offset-2 dark:text-blue-400">${emph(t)}</a>`,
        ),
      )
      .replace(/(^|[^\w/=&?.#-])([FBITRD]\d{1,5}|r\d{1,6}|#\d{1,6})(?!\w)/g, (m, pre: string, c: string) => {
        const l = refs && refLink(c)
        return l ? pre + keep(l) : m
      }) // not inside a web address
      // A bare web address becomes a link wherever it stands, also right after Chinese text (F76); final punctuation
      // stays outside the link.
      .replace(/https?:\/\/(?:&amp;|[A-Za-z0-9\-._~:/?#@!$+,;=%])+/g, (m) => {
        let url = m
        while (/[.,;:!?]$/.test(url) && !/&amp;$/.test(url)) url = url.slice(0, -1)
        return `<a href="${url}" target="_blank" rel="noopener" class="break-all text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400">${url}</a>${m.slice(url.length)}`
      })
      .replace(/\u0001(\d+)\u0001/g, (_, i: string) => links[Number(i)])
      .replace(
        /\u0000(\d+)\u0000/g,
        (_, i: string) =>
          `<code class="rounded bg-zinc-100 px-1 font-mono text-[13px] dark:bg-zinc-800">${codes[Number(i)]}</code>`,
      ),
  )
}

// Choices in a question (F56): "- ( ) option" picks one, "- [ ] option" picks any. In the open question of item
// `form` they can be tapped and sent as the user's answer; elsewhere they just show.
function choiceHtml(labels: string[], multi: boolean, n: number, base: number, done: string[] | null = null) {
  const picked = n && U.choice?.n === n ? U.choice.picked : new Set<number>()
  return `<div class="space-y-1.5" role="group">${labels
    .map((l, k) => {
      const i = base + k,
        on = done ? done.includes(l.trim()) : picked.has(i)
      return `<button ${n ? `data-act="choice" data-n="${n}" data-i="${i}" data-multi="${multi ? 1 : ''}"` : 'disabled'} aria-pressed="${on}" class="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[15px] leading-snug aria-pressed:border-blue-500 aria-pressed:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:aria-pressed:border-blue-400 dark:aria-pressed:bg-blue-400/10 ${n ? 'hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/70' : ''} ${done && !on ? 'opacity-50' : ''}">
      <span class="grid size-5 shrink-0 place-items-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} border-zinc-300 group-aria-pressed:border-blue-600 group-aria-pressed:bg-blue-600 group-aria-pressed:text-white dark:border-zinc-600 dark:group-aria-pressed:border-blue-400 dark:group-aria-pressed:bg-blue-400 dark:group-aria-pressed:text-zinc-900">${ico('check', 'size-3.5 invisible group-aria-pressed:visible', '3')}</span>
      <span class="min-w-0 flex-1">${inlineMd(l, '', false)}</span>${n && i < 9 ? KBD(String(i + 1)) : ''}</button>`
    })
    .join('')}</div>`
}

// B301: the choices you ticked and did not send yet come back after a reload, by their words
export const choiceKept = (n: number): string[] => {
  try {
    const x = JSON.parse(localStorage.getItem('taska.choice.' + ctx.HERE) || 'null')
    return x?.n === n ? x.picked || [] : []
  } catch {
    return []
  }
}

export function mdHtml(text: string, gid = '', form = 0, done: string[] | null = null) {
  if (gid) groups.delete(gid)
  const lines = text.replace(/\r/g, '').split('\n'),
    blocks: { kind: string; lines: string[] }[] = []
  let cur: { kind: string; lines: string[] } | null = null
  const add = (kind: string, line: string) => {
    if (cur?.kind !== kind) blocks.push((cur = { kind, lines: [] }))
    cur.lines.push(line)
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^\s*```/.test(l)) {
      const a = i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) i++
      blocks.push({ kind: 'code', lines: lines.slice(a, i + 1) })
      cur = null
    } else if (!l.trim()) cur = null
    else if (/^#{1,6}\s/.test(l)) {
      blocks.push({ kind: 'heading', lines: [l] })
      cur = null
    } else if (/^\s*>/.test(l)) add('quote', l)
    else if (/^\s*([-*+]|\d+[.)])\s/.test(l)) add(/^\s*\d/.test(l) ? 'ol' : 'ul', l)
    // a list may follow a line directly
    else if (cur && /^(ol|ul)$/.test((cur as { kind: string }).kind) && /^\s{2,}\S/.test(l))
      (cur as { lines: string[] }).lines.push(l)
    else if (/^\s*\|/.test(l) && TABLE_SEP.test(lines[i + 1] || '')) {
      const a = i
      i += 2
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++
      blocks.push({ kind: 'table', lines: lines.slice(a, i--) })
      cur = null
    } else add('para', l)
  }
  const labels: string[] = []
  const html = blocks
    .map((b) => {
      const items =
        b.kind === 'ul'
          ? b.lines.reduce<string[]>((acc, l) => {
              if (/^\s*[-*+]\s/.test(l)) acc.push(l)
              else acc[acc.length - 1] += ' ' + l.trim()
              return acc
            }, [])
          : []
      // In a question, choices can be picked also when its list has other points before them (B163)
      if (
        items.length &&
        (items.every((l) => CHOICE.test(l)) || ((form || done) && items.some((l) => CHOICE.test(l))))
      ) {
        const runs: { c: boolean; ls: string[] }[] = []
        for (const l of items) {
          const c = CHOICE.test(l)
          if (runs.at(-1)?.c !== c) runs.push({ c, ls: [] })
          runs.at(-1)?.ls.push(l)
        }
        return runs
          .map((r) => {
            if (!r.c) return blockHtml({ kind: 'list', text: r.ls.join('\n') }, false, gid)
            const multi = r.ls[0].match(CHOICE)?.[1] === '[',
              base = labels.length
            labels.push(...r.ls.map((l) => l.replace(CHOICE, '')))
            if (form && !done && U.choice?.n !== form) {
              const kept = choiceKept(form),
                on = labels.flatMap((l, i) => (kept.includes(l) ? [i] : []))
              if (on.length) U.choice = { n: form, picked: new Set(on) } // B301: ticked before a reload
            }
            return choiceHtml(labels.slice(base), multi, form, base, done)
          })
          .join('')
      }
      return blockHtml({ kind: /^(ol|ul)$/.test(b.kind) ? 'list' : b.kind, text: b.lines.join('\n') }, false, gid)
    })
    .join('')
  if (form && labels.length) U.choiceLabels[form] = labels // the answer is sent with the Send answer button
  return html
}

// A Markdown table: header, alignment row, body. Cells take inline Markdown; \| is a pipe inside a cell.
function tableHtml(text: string, gid: string) {
  const cells = (l: string) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .replace(/\\\|/g, '\u0002')
      .split('|')
      .map((c) => c.trim().replace(/\u0002/g, '|'))
  const [head, sep, ...body] = text.trim().split('\n').map(cells)
  const align = (sep || []).map((c) => (/^:-+:$/.test(c) ? 'text-center' : /-:$/.test(c) ? 'text-right' : 'text-left'))
  // F215: a framed table that fits its column; T252, B275: on a phone a table of 3 or more columns reads as cards
  const cell = 'min-w-32 max-w-[28rem] border-r border-b px-3 py-2 wrap-anywhere last:border-r-0'
  const cards =
    head.length >= 3
      ? `<div class="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-[14.5px] leading-relaxed sm:hidden dark:divide-zinc-700 dark:border-zinc-700">${body
          .map(
            (r) => `<div class="px-3.5 py-3 even:bg-zinc-50/60 dark:even:bg-zinc-800/25">
      <div class="font-semibold wrap-anywhere text-zinc-900 dark:text-zinc-100">${inlineMd(r[0] || '', gid)}</div>${head
        .slice(1)
        .map((h, i) =>
          (r[i + 1] || '').trim()
            ? `<div class="mt-1.5"><div class="text-xs font-medium text-zinc-500 dark:text-zinc-400">${inlineMd(h, gid)}</div><div class="wrap-anywhere">${inlineMd(r[i + 1], gid)}</div></div>`
            : '',
        )
        .join('')}</div>`,
          )
          .join('')}</div>`
      : ''
  return (
    cards +
    `<div class="${cards ? 'hidden sm:block ' : ''}overflow-x-auto rounded-lg border border-zinc-200 lg:scrollbar-thin dark:border-zinc-700"><table class="w-full border-collapse text-[13.5px] leading-relaxed">
    <thead class="bg-zinc-50 dark:bg-zinc-800/60"><tr>${head.map((c, i) => `<th class="${cell} border-zinc-200 align-bottom font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100 ${align[i] || 'text-left'}">${inlineMd(c, gid)}</th>`).join('')}</tr></thead>
    <tbody>${body.map((r) => `<tr class="even:bg-zinc-50/60 last:[&>td]:border-b-0 dark:even:bg-zinc-800/25">${head.map((_, i) => `<td class="${cell} border-zinc-100 align-top dark:border-zinc-800 ${align[i] || 'text-left'}">${inlineMd(r[i] || '', gid)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  )
}

export function blockHtml(b: { kind: string; text: string }, isTitle: boolean, gid = ''): string {
  if (b.kind === 'table') return tableHtml(b.text, gid)
  if (isTitle)
    return `<div class="text-2xl leading-tight font-bold tracking-tight">${inlineMd(b.text.replace(/^#+\s*/, ''), gid)}</div>`
  if (b.kind === 'heading') {
    const level = (b.text.match(/^#+/) || ['#'])[0].length
    return `<div class="${level <= 2 ? 'mt-2 text-xl' : 'mt-1 text-[17px]'} leading-snug font-semibold">${inlineMd(b.text.replace(/^#+\s*/, ''), gid)}</div>`
  }
  if (b.kind === 'code')
    return `<pre class="overflow-x-auto whitespace-pre-wrap wrap-anywhere sm:whitespace-pre sm:[overflow-wrap:normal] lg:scrollbar-thin rounded-lg bg-zinc-100 p-3 font-mono text-[13px] leading-relaxed dark:bg-zinc-800"><code>${esc(b.text.replace(/^\s*```[^\n]*\n?/, '').replace(/\n?\s*```\s*$/, ''))}</code></pre>`
  if (b.kind === 'quote')
    return `<blockquote class="border-l-[3px] border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">${inlineMd(b.text.replace(/^\s*>\s?/gm, ''), gid).replace(/\n/g, '<br>')}</blockquote>`
  if (b.kind === 'list') {
    // T227 #3: an indented item is a level deeper, as written
    const items = b.text.split('\n').reduce<{ lv: number; ol: boolean; t: string }[]>((acc, l) => {
      const m = /^(\s*)([-*+]|\d+[.)])\s+/.exec(l)
      if (m)
        acc.push({ lv: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ol: /\d/.test(m[2]), t: l.slice(m[0].length) })
      else if (acc.length) acc[acc.length - 1].t += ' ' + l.trim()
      return acc
    }, [])
    const nest = (from: number, lv: number): [string, number] => {
      let html = '',
        i = from
      const ol = items[from]?.ol
      while (i < items.length && items[i].lv >= lv) {
        if (items[i].lv > lv) {
          const [h, j] = nest(i, items[i].lv)
          html = html.replace(/<\/li>$/, h + '</li>')
          i = j
          continue
        }
        html += `<li>${inlineMd(items[i].t, gid)}</li>`
        i++
      }
      return [
        `<${ol ? 'ol' : 'ul'} class="${ol ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 marker:text-zinc-400 [&_ol]:mt-1.5 [&_ul]:mt-1.5">${html}</${ol ? 'ol' : 'ul'}>`,
        i,
      ]
    }
    return items.length ? nest(0, items[0].lv)[0] : ''
  }
  return `<p class="leading-[1.75] whitespace-pre-wrap">${inlineMd(b.text, gid)}</p>`
}

/** The HTML for some Markdown, checked by DOMPurify (data-* attributes and Taska's buttons stay). */
// T339: the same text drawn again (another tab, a redraw) is not turned into HTML and cleaned again; what it gives
// depends on the items too (their links), so the kept ones go when the state changes
const RICH = { rev: -1, pv: -1, dims: 0, map: new Map<string, string>() }
export function richHtml(text: string, gid = '', cls = '', form = 0, done: string[] | null = null) {
  const S = model.S
  if (RICH.rev !== S.rev || RICH.pv !== S.pv || RICH.dims !== DIMS.size || RICH.map.size > 4000) {
    RICH.map.clear()
    RICH.rev = S.rev
    RICH.pv = S.pv
    RICH.dims = DIMS.size // F353: pictures' sizes came: drawn again with their places kept
  }
  const key = [gid, cls, done ? done.join('\u0001') : '-', text].join('\u0002')
  let html = form ? undefined : RICH.map.get(key) // a question's choices follow what you ticked: drawn each time
  if (html === undefined) {
    html = clean(
      `<div class="space-y-2 break-words [&_p]:leading-relaxed ${cls}">${mdHtml(text, gid, form, done)}</div>`,
    )
    if (!form) RICH.map.set(key, html)
  }
  return html
}
export const clean = (html: string) =>
  DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'data-act', 'aria-pressed', 'role', 'tabindex'], ADD_TAGS: ['kbd'] })
// A quote from a document reads as words, not Markdown: no ** or `, no table pipes or rules (B157).
export const plainQuote = (s: unknown) =>
  String(s || '')
    .split('\n')
    .filter((l) => !TABLE_SEP.test(l))
    .map((l) =>
      l
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s*(#+|>|[-*+]|\d+[.)])\s+/, '')
        .replace(/\*\*|__|`/g, '')
        .replace(/^\s*\||\|\s*$/g, '')
        .replace(/\s*\|\s*/g, ' · ')
        .trim(),
    )
    .filter(Boolean)
    .join(' ')
