// A document's sheets: a comment's menu on the phone, and where in its document a comment goes (the whole document,
// or one of its paragraphs). Props only.

import type { ReactNode } from 'react'
import { oneLine } from '../../model/items'
import { plainQuote } from '../../model/markdown'
import type { Doc } from '../../model/types'
import { Icon } from '../../ui/Icon'
import type { SheetParts } from '../../ui/Sheet'
import { DANGER, MENU_ROW } from '../../ui/tones'

/** The phone's menu of a comment: Edit (yours), Move, Delete. */
export function commentMenuSheet(yours: boolean, on: { edit(): void; move(): void; remove(): void }): SheetParts {
  return {
    menu: true,
    title: 'Comment',
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        {yours ? (
          <button onClick={on.edit} className={`${MENU_ROW} h-11`}>
            <Icon n="pencil" c="size-4 text-zinc-500 dark:text-zinc-400" />
            Edit
          </button>
        ) : null}
        <button onClick={on.move} className={`${MENU_ROW} h-11`}>
          <Icon n="arrow" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Move
        </button>
        <button onClick={on.remove} className={`${MENU_ROW} h-11 ${DANGER}`}>
          <Icon n="trash" c="size-4" />
          Delete
        </button>
      </div>
    ),
  }
}

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
    title: 'Move comment to…',
    body: (
      <div className="-mx-1 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto outline-none">
        {opt('doc', <b>Whole document</b>)}
        {/* each paragraph read as words (a table's cells, not its pipes) */}
        {doc.blocks.map((x) => opt(x.key, oneLine(plainQuote(x.text)).slice(0, 120)))}
      </div>
    ),
  }
}
