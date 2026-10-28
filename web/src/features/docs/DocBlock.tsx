// One paragraph of a document, drawn as what the document says it is (a heading, a list, a quote, code, a table, or
// words); its first paragraph, when it is the title, as the title. Its choices are a form filled in place (a tap
// ticks one); sent and not changed since, the form keeps its look, quieter, with Submitted and Modify. Props only.

import { isTicked } from '../../model/docTicks'
import { blocks, CHOICE, listOf, type MdBlock } from '../../model/markdown'
import type { Block as DocPart } from '../../model/types'
import { Icon } from '../../ui/Icon'
import { Block } from '../../ui/Markdown'
import { clean, inlineHtml, type InlineWorld } from '../../ui/markdown/inline'

export interface Ticking {
  /** sent and not changed since: shown as sent */
  sent: boolean
  tick(i: number): void
  modify(): void
}

function TickForm({ lines, from, foot, t, world }: { lines: string[]; from: number; foot: boolean; t: Ticking; world: InlineWorld }) {
  const multi = lines[0].match(CHOICE)?.[1] === '['
  const box = `grid size-5 shrink-0 place-items-center border-2 ${multi ? 'rounded-md' : 'rounded-full'}`
  const check = <Icon n="check" c="size-3.5 invisible group-aria-pressed:visible" sw="3" />
  return (
    <div className="group/form space-y-1.5" role="group">
      {lines.map((l, i) => {
        const on = isTicked(l)
        const words = <span className="min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: clean(inlineHtml(l.replace(CHOICE, ''), world, false)) }} />
        return t.sent ? (
          <div
            key={i}
            aria-pressed={on}
            className="group flex min-h-10 w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-[15px] leading-snug text-zinc-500 aria-pressed:border-zinc-400 aria-pressed:text-zinc-800 dark:border-zinc-800 dark:text-zinc-500 dark:aria-pressed:border-zinc-600 dark:aria-pressed:text-zinc-200"
          >
            <span className={`${box} border-zinc-300 group-aria-pressed:border-zinc-500 group-aria-pressed:bg-zinc-500 group-aria-pressed:text-white dark:border-zinc-700 dark:group-aria-pressed:border-zinc-500 dark:group-aria-pressed:bg-zinc-500 dark:group-aria-pressed:text-zinc-900`}>{check}</span>
            {words}
          </div>
        ) : (
          <button
            key={i}
            onClick={(e) => (e.stopPropagation(), t.tick(from + i))}
            aria-pressed={on}
            className="group flex min-h-10 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-[15px] leading-snug hover:border-zinc-300 hover:bg-zinc-50 aria-pressed:border-blue-500 aria-pressed:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/70 dark:aria-pressed:border-blue-400 dark:aria-pressed:bg-blue-400/10"
          >
            <span className={`${box} border-zinc-300 group-aria-pressed:border-blue-600 group-aria-pressed:bg-blue-600 group-aria-pressed:text-white dark:border-zinc-600 dark:group-aria-pressed:border-blue-400 dark:group-aria-pressed:bg-blue-400 dark:group-aria-pressed:text-zinc-900`}>{check}</span>
            {words}
          </button>
        )
      })}
      {t.sent && foot ? (
        <p className="flex h-7 items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Submitted
          <button
            onClick={(e) => (e.stopPropagation(), t.modify())}
            className="rounded-md px-1.5 py-0.5 font-semibold text-blue-600 hover:bg-blue-50 lg:opacity-0 lg:group-hover/form:opacity-100 lg:focus-visible:opacity-100 dark:text-blue-400 dark:hover:bg-blue-400/10"
          >
            Modify
          </button>
        </p>
      ) : null}
    </div>
  )
}

/** It has choices to tick. */
const hasChoices = (b: Pick<DocPart, 'kind' | 'text'>) => (b.kind === 'list' || b.kind === 'para') && b.text.split('\n').some((l) => CHOICE.test(l))

/** A paragraph with choices in it: the choices as a form, the words around them as they are. */
function Ticks({ b, t, world }: { b: Pick<DocPart, 'kind' | 'text'>; t: Ticking; world: InlineWorld }) {
  const ls = b.text.split('\n').filter((l) => l.trim())
  if (ls.every((l) => CHOICE.test(l))) return <TickForm lines={ls} from={0} foot t={t} world={world} />
  // choices right under some words: the words as they are, the choices a form (Submitted once, under the last one)
  const last = ls.map((l) => CHOICE.test(l)).lastIndexOf(true)
  const runs: { choice: boolean; lines: string[]; from: number; end: number }[] = []
  let at = 0
  for (let i = 0; i < ls.length; ) {
    const choice = CHOICE.test(ls[i])
    const run: string[] = []
    while (i < ls.length && CHOICE.test(ls[i]) === choice) run.push(ls[i++])
    runs.push({ choice, lines: run, from: at, end: i })
    if (choice) at += run.length
  }
  return (
    <div className="space-y-2">
      {runs.map((r, k) =>
        r.choice ? (
          <TickForm key={k} lines={r.lines} from={r.from} foot={r.end > last} t={t} world={world} />
        ) : (
          <DocBlock key={k} b={{ kind: /^\s*([-*+]|\d+\.)\s/.test(r.lines[0]) ? 'list' : 'para', text: r.lines.join('\n') }} title={false} world={world} />
        ),
      )}
    </div>
  )
}

/** The block it shows as (the document said what kind of paragraph it is: it is not read again). */
export function asBlock(b: Pick<DocPart, 'kind' | 'text'>): MdBlock | null {
  switch (b.kind) {
    case 'heading': {
      const level = (b.text.match(/^#+/) || ['#'])[0].length
      return { kind: 'heading', level, text: b.text.replace(/^#+\s*/, '') }
    }
    case 'code':
      return { kind: 'code', text: b.text.replace(/^\s*```[^\n]*\n?/, '').replace(/\n?\s*```\s*$/, '') }
    case 'quote':
      return { kind: 'quote', text: b.text.replace(/^\s*>\s?/gm, '') }
    case 'list': {
      const list = listOf(b.text)
      return list ? { kind: 'list', list } : null
    }
    case 'table':
      return blocks(b.text).find((x) => x.kind === 'table') ?? { kind: 'para', text: b.text }
    default:
      return { kind: 'para', text: b.text }
  }
}

export function DocBlock({ b, title, world, ticking }: { b: Pick<DocPart, 'kind' | 'text'>; title: boolean; world: InlineWorld; ticking?: Ticking }) {
  if (ticking && hasChoices(b)) return <Ticks b={b} t={ticking} world={world} />
  if (title) return <div className="text-2xl leading-tight font-bold tracking-tight" dangerouslySetInnerHTML={{ __html: clean(inlineHtml(b.text.replace(/^#+\s*/, ''), world)) }} />
  const md = asBlock(b)
  return md ? <Block b={md} world={world} /> : null
}
