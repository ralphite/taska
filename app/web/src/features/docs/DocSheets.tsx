// A document's sheets: where in it a comment goes (the whole document, or one of its paragraphs). Props only.

import type { ReactNode } from 'react'
import { oneLine } from '../../model/items'
import type { Doc } from '../../model/types'
import type { SheetParts } from '../../ui/Sheet'

/** Where in its document a comment goes: the whole document, or one of its paragraphs. */
export function commentMoveSheet(doc: Doc, current: string, onPick: (key: string) => void): SheetParts {
  const opt = (key: string, label: ReactNode) => (
    <button
      key={key}
      onClick={() => onPick(key)}
      {...(key === current ? { 'aria-current': 'true' as const } : {})}
      className="flex min-h-11 w-full items-center rounded-lg px-3 py-1.5 text-left text-sm hover:bg-zinc-100 aria-[current=true]:bg-blue-50 dark:hover:bg-zinc-800 dark:aria-[current=true]:bg-blue-400/10"
    >
      <span className="line-clamp-2">{label}</span>
    </button>
  )
  return {
    title: 'Move the comment to…',
    body: (
      <div className="-mx-1 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
        {opt('doc', <b>The whole document</b>)}
        {doc.blocks.map((x) => opt(x.key, oneLine(x.text).slice(0, 120)))}
      </div>
    ),
  }
}
