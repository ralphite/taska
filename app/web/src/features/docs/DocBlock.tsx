// One paragraph of a document, drawn as what the document says it is (a heading, a list, a quote, code, a table, or
// words); its first paragraph, when it is the title, as the title. Props only.

import { blocks, listOf, type MdBlock } from '../../model/markdown'
import type { Block as DocPart } from '../../model/types'
import { Block } from '../../ui/Markdown'
import { clean, inlineHtml, type InlineWorld } from '../../ui/markdown/inline'

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

export function DocBlock({ b, title, world }: { b: Pick<DocPart, 'kind' | 'text'>; title: boolean; world: InlineWorld }) {
  if (title) return <div className="text-2xl leading-tight font-bold tracking-tight" dangerouslySetInnerHTML={{ __html: clean(inlineHtml(b.text.replace(/^#+\s*/, ''), world)) }} />
  const md = asBlock(b)
  return md ? <Block b={md} world={world} /> : null
}
