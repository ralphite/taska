// The words of a block as HTML: `code`, pictures (![alt](f12-a.png) for a file sent to Taska, or a web address),
// links, Taska's codes (T12, D17, r360, #360) as links to what they name, bare web addresses, **bold** and *italic*.
// Everything is escaped first; DOMPurify checks the result. What a code names, and a picture's address and size,
// come from the caller.

import DOMPurify from 'dompurify'

export type RefTarget = { kind: 'item'; n: number } | { kind: 'doc'; d: number } | { kind: 'input'; id: string }

export interface InlineWorld {
  /** what a code names in this project (a code naming nothing stays words) */
  find(code: string): RefTarget | null
  /** a file's address */
  url(fid: string): string
  /** a picture's width and height, when known (its place is kept before it loads) */
  size(fid: string): readonly [number, number] | undefined
}

export const REF_CLS = 'cursor-pointer font-medium text-blue-600 hover:underline dark:text-blue-400'

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const refHtml = (c: string, to: RefTarget | null): string | null =>
  to ? `<span role="link" tabindex="0" data-ref="${c}" class="${REF_CLS}">${c}</span>` : null

function pictureHtml(alt: string, src: string, world: InlineWorld): string {
  if (/^https?:\/\//.test(src))
    return `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${alt}" loading="lazy" class="my-1 max-h-96 max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700"></a>`
  // its size known, the picture's place is kept before it loads (as tall as 24rem at most); while it loads a spinner
  // holds its place; if it cannot load, it says so
  const wh = world.size(src)
  const box = wh
    ? ` width="${wh[0]}" height="${wh[1]}" style="aspect-ratio:${wh[0]}/${wh[1]};width:${Math.round(Math.min(wh[0], (384 * wh[0]) / wh[1]))}px"`
    : ''
  return `<button data-f="${src}" class="group/img relative my-1 block max-w-full"><img data-pic src="${world.url(src)}" alt="${alt}" loading="lazy"${box} class="h-auto max-h-96 max-w-full rounded-lg border border-zinc-200 bg-zinc-100 object-contain data-failed:hidden data-loaded:bg-transparent dark:border-zinc-700 dark:bg-zinc-800 dark:data-loaded:bg-transparent"><span class="pointer-events-none absolute inset-0 grid place-items-center group-has-[img[data-loaded]]/img:hidden group-has-[img[data-failed]]/img:hidden"><span class="size-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300"></span></span><span class="pointer-events-none hidden min-w-48 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 p-3 text-center text-[13px] text-zinc-500 group-has-[img[data-failed]]/img:flex dark:border-zinc-700 dark:text-zinc-400"><span class="font-medium">Could not load the picture</span><span class="max-w-full truncate font-mono text-xs">${src}</span></span></button>`
}

const emph = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')

/** The pictures a text shows, in order (for the viewer's Previous and Next). */
export const picturesIn = (s: string) => [...s.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((src) => !/^https?:\/\//.test(src))

/** One block's words as HTML (not yet checked: see `clean`). `refs`: codes become links. */
export function inlineHtml(s: string, world: InlineWorld, refs = true): string {
  const codes: string[] = []
  const kept: string[] = [] // finished parts, set aside (behind private-use marks) until the rest is done
  const keep = (html: string) => `\ue001${kept.push(html) - 1}\ue001`
  return emph(
    esc(s)
      .replace(/`([^`]+)`/g, (_, c: string) => `\ue000${codes.push(c) - 1}\ue000`)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, src: string) => keep(pictureHtml(alt, src, world)))
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t: string, url: string) =>
        keep(`<a href="${url}" target="_blank" rel="noopener" class="text-blue-600 underline underline-offset-2 dark:text-blue-400">${emph(t)}</a>`),
      )
      // a code, not inside a web address
      .replace(/(^|[^\w/=&?.#-])([FBITRD]\d{1,5}|r\d{1,6}|#\d{1,6})(?!\w)/g, (m, pre: string, c: string) => {
        const l = refs ? refHtml(c, world.find(c)) : null
        return l ? pre + keep(l) : m
      })
      // a bare web address is a link wherever it stands, also right after Chinese text; final punctuation stays out
      .replace(/https?:\/\/(?:&amp;|[A-Za-z0-9\-._~:/?#@!$+,;=%])+/g, (m) => {
        let url = m
        while (/[.,;:!?]$/.test(url) && !/&amp;$/.test(url)) url = url.slice(0, -1)
        return `<a href="${url}" target="_blank" rel="noopener" class="break-all text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400">${url}</a>${m.slice(url.length)}`
      })
      .replace(/\ue001(\d+)\ue001/g, (_, i: string) => kept[Number(i)])
      .replace(/\ue000(\d+)\ue000/g, (_, i: string) => `<code class="rounded bg-zinc-100 px-1 font-mono text-[13px] dark:bg-zinc-800">${codes[Number(i)]}</code>`),
  )
}

/** HTML checked by DOMPurify: Taska's attributes stay (data-*, the link targets, the pressed state, the roles). */
export const clean = (html: string) =>
  DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'aria-pressed', 'role', 'tabindex'], ADD_TAGS: ['kbd'] })
