// Text as Taska shows it: its blocks (model/markdown) drawn as paragraphs, headings, quotes, lists, tables (cards on a
// narrow screen), code and choices. In an open question the choices are buttons; answered, they keep their place and
// shape, quieter, yours ticked. A code in the words opens what it names, a picture opens the viewer. Props only.

import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { blocks, type ListNode, type MdBlock } from '../model/markdown'
import { Kbd } from './bits'
import { Icon } from './Icon'
import { clean, inlineHtml, picturesIn, type InlineWorld } from './markdown/inline'

export interface Choosing {
  /** the choices picked so far, by their number */
  picked: ReadonlySet<number>
  pick(i: number, multi: boolean): void
}

export interface RichProps {
  text: string
  world: InlineWorld
  cls?: string
  /** an open question: its choices can be picked */
  choosing?: Choosing | null
  /** an answered question: the choices that were picked, by their words */
  done?: readonly string[] | null
  onRef?(code: string): void
  onPicture?(fid: string, all: string[]): void
}

const html = (s: string, world: InlineWorld, refs = true) => ({ __html: clean(inlineHtml(s, world, refs)) })

function listHtml(list: ListNode, world: InlineWorld): string {
  const items = list.items.map((it) => `<li>${inlineHtml(it.text, world)}${it.subs.map((s) => listTag(s, world)).join('')}</li>`).join('')
  return items
}
const LIST_CLS = (ordered: boolean) => `${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 marker:text-zinc-400 [&_ol]:mt-1.5 [&_ul]:mt-1.5`
const listTag = (list: ListNode, world: InlineWorld) => {
  const tag = list.ordered ? 'ol' : 'ul'
  return `<${tag} class="${LIST_CLS(list.ordered)}">${listHtml(list, world)}</${tag}>`
}

const CELL = 'min-w-32 max-w-[28rem] border-r border-b px-3 py-2 wrap-anywhere last:border-r-0'

function Table({ b, world }: { b: Extract<MdBlock, { kind: 'table' }>; world: InlineWorld }) {
  // a framed table that fits its column; on a phone a table of 3 or more columns reads as cards
  const cards = b.head.length >= 3
  return (
    <>
      {cards ? (
        <div className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-[14.5px] leading-relaxed sm:hidden dark:divide-zinc-700 dark:border-zinc-700">
          {b.rows.map((r, i) => (
            <div key={i} className="px-3.5 py-3 even:bg-zinc-50/60 dark:even:bg-zinc-800/25">
              <div className="font-semibold wrap-anywhere text-zinc-900 dark:text-zinc-100" dangerouslySetInnerHTML={html(r[0] || '', world)} />
              {b.head.slice(1).map((h, k) =>
                (r[k + 1] || '').trim() ? (
                  <div key={k} className="mt-1.5">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400" dangerouslySetInnerHTML={html(h, world)} />
                    <div className="wrap-anywhere" dangerouslySetInnerHTML={html(r[k + 1], world)} />
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </div>
      ) : null}
      <div className={`${cards ? 'hidden sm:block ' : ''}overflow-x-auto rounded-lg border border-zinc-200 lg:scrollbar-thin dark:border-zinc-700`}>
        <table className="w-full border-collapse text-[13.5px] leading-relaxed">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60">
            <tr>
              {b.head.map((c, i) => (
                <th
                  key={i}
                  className={`${CELL} border-zinc-200 align-bottom font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100 ${b.align[i] || 'text-left'}`}
                  dangerouslySetInnerHTML={html(c, world)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i} className="even:bg-zinc-50/60 last:[&>td]:border-b-0 dark:even:bg-zinc-800/25">
                {b.head.map((_, k) => (
                  <td key={k} className={`${CELL} border-zinc-100 align-top dark:border-zinc-800 ${b.align[k] || 'text-left'}`} dangerouslySetInnerHTML={html(r[k] || '', world)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Choices({ b, world, choosing, done }: { b: Extract<MdBlock, { kind: 'choices' }>; world: InlineWorld; choosing?: Choosing | null; done?: readonly string[] | null }) {
  const box = `grid size-5 shrink-0 place-items-center border-2 ${b.multi ? 'rounded-md' : 'rounded-full'}`
  const check = <Icon n="check" c="size-3.5 invisible group-aria-pressed:visible" sw="3" />
  return (
    <div className="space-y-1.5" role="group">
      {b.labels.map((l, k) => {
        const i = b.base + k
        const on = done ? done.includes(l.trim()) : !!choosing?.picked.has(i)
        const words = <span className="min-w-0 flex-1" dangerouslySetInnerHTML={html(l, world, false)} />
        if (done && !choosing)
          return (
            <div
              key={k}
              aria-pressed={on}
              className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] leading-snug text-zinc-500 aria-pressed:border-zinc-400 aria-pressed:text-zinc-800 dark:border-zinc-800 dark:text-zinc-500 dark:aria-pressed:border-zinc-600 dark:aria-pressed:text-zinc-200"
            >
              <span className={`${box} border-zinc-300 group-aria-pressed:border-zinc-500 group-aria-pressed:bg-zinc-500 group-aria-pressed:text-white dark:border-zinc-700 dark:group-aria-pressed:border-zinc-500 dark:group-aria-pressed:bg-zinc-500 dark:group-aria-pressed:text-zinc-900`}>{check}</span>
              {words}
            </div>
          )
        return (
          <button
            key={k}
            disabled={!choosing}
            onClick={choosing ? () => choosing.pick(i, b.multi) : undefined}
            aria-pressed={on}
            className={`group flex min-h-11 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[15px] leading-snug aria-pressed:border-blue-500 aria-pressed:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:aria-pressed:border-blue-400 dark:aria-pressed:bg-blue-400/10 ${choosing ? 'hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/70' : ''}`}
          >
            <span className={`${box} border-zinc-300 group-aria-pressed:border-blue-600 group-aria-pressed:bg-blue-600 group-aria-pressed:text-white dark:border-zinc-600 dark:group-aria-pressed:border-blue-400 dark:group-aria-pressed:bg-blue-400 dark:group-aria-pressed:text-zinc-900`}>{check}</span>
            {words}
            {choosing && i < 9 ? <Kbd k={String(i + 1)} /> : null}
          </button>
        )
      })}
    </div>
  )
}

function Block({ b, world, choosing, done }: { b: MdBlock; world: InlineWorld; choosing?: Choosing | null; done?: readonly string[] | null }) {
  switch (b.kind) {
    case 'para':
      return <p className="leading-[1.75] whitespace-pre-wrap" dangerouslySetInnerHTML={html(b.text, world)} />
    case 'heading':
      return <div className={`${b.level <= 2 ? 'mt-2 text-xl' : 'mt-1 text-[17px]'} leading-snug font-semibold`} dangerouslySetInnerHTML={html(b.text, world)} />
    case 'quote':
      return (
        <blockquote
          className="border-l-[3px] border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
          dangerouslySetInnerHTML={{ __html: clean(inlineHtml(b.text, world).replace(/\n/g, '<br>')) }}
        />
      )
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-[13px] leading-relaxed wrap-anywhere whitespace-pre-wrap sm:whitespace-pre sm:[overflow-wrap:normal] lg:scrollbar-thin dark:bg-zinc-800">
          <code>{b.text}</code>
        </pre>
      )
    case 'list': {
      const Tag = b.list.ordered ? 'ol' : 'ul'
      return <Tag className={LIST_CLS(b.list.ordered)} dangerouslySetInnerHTML={{ __html: clean(listHtml(b.list, world)) }} />
    }
    case 'table':
      return <Table b={b} world={world} />
    case 'choices':
      return <Choices b={b} world={world} choosing={choosing} done={done} />
  }
}

export function Rich({ text, world, cls = '', choosing = null, done = null, onRef, onPicture }: RichProps) {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    // a picture in the words says when it has loaded, or could not: its place shows a spinner until then, or says so
    const el = root.current
    if (!el) return
    const mark = (img: HTMLImageElement, ok: boolean) => img.setAttribute(ok ? 'data-loaded' : 'data-failed', '')
    const seen = (e: Event) => {
      const t = e.target
      if (t instanceof HTMLImageElement && t.hasAttribute('data-pic')) mark(t, e.type === 'load')
    }
    for (const img of el.querySelectorAll<HTMLImageElement>('img[data-pic]')) if (img.complete) mark(img, img.naturalWidth > 0)
    el.addEventListener('load', seen, true)
    el.addEventListener('error', seen, true)
    return () => {
      el.removeEventListener('load', seen, true)
      el.removeEventListener('error', seen, true)
    }
  })
  const click = (e: MouseEvent) => {
    const t = e.target as Element
    const ref = t.closest<HTMLElement>('[data-ref]')
    if (ref && onRef) {
      e.stopPropagation()
      return onRef(ref.dataset.ref || '')
    }
    const pic = t.closest<HTMLElement>('button[data-f]')
    if (pic && onPicture) {
      e.stopPropagation()
      onPicture(pic.dataset.f || '', picturesIn(text))
    }
  }
  const key = (e: KeyboardEvent) => {
    const ref = (e.target as Element).closest<HTMLElement>('[data-ref]')
    if (e.key === 'Enter' && ref && onRef) {
      e.stopPropagation()
      onRef(ref.dataset.ref || '')
    }
  }
  return (
    <div ref={root} onClick={click} onKeyDown={key} className={`space-y-2 break-words [&_p]:leading-relaxed ${cls}`}>
      {blocks(text, !!choosing || !!done).map((b, i) => (
        <Block key={i} b={b} world={world} choosing={choosing} done={done} />
      ))}
    </div>
  )
}
