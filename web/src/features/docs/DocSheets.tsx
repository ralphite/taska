// A document's sheets: a comment's menu on the phone, and where in its document a comment goes (the whole document,
// or one of its paragraphs). Props only.

import type { ReactNode } from 'react'
import { oneLine } from '../../model/items'
import { plainQuote } from '../../model/markdown'
import type { Block, Doc } from '../../model/types'
import { Icon } from '../../ui/Icon'
import { CurrentMark } from '../../ui/bits'
import type { SheetParts } from '../../ui/Sheet'
import type { IconName } from '../../ui/icon-paths'
import { DANGER, MENU_ROW, MENU_SEP } from '../../ui/tones'

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

/** The phone's ⋯ beside a document's close button (D115 #41), a web page's Full screen before it (F751); while an area
 * is being marked, Done in its place. */
export function DocSheetMore({ code, circle, on }: { code: string; circle: boolean; on: { more(): void; done(): void; full?(): void } }) {
  const more = (
    <button onClick={on.more} aria-label={`More for ${code}`} className="group -mr-2 grid size-11 shrink-0 place-items-center rounded-full">
      <span className="grid size-8 place-items-center rounded-full text-zinc-500 group-hover:bg-zinc-100 dark:text-zinc-400 dark:group-hover:bg-zinc-800">
        <Icon n="more" c="size-5" />
      </span>
    </button>
  )
  return circle ? (
    <button onClick={on.done} className="h-9 rounded-full bg-amber-100 px-3.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
      Done
    </button>
  ) : on.full ? (
    <>
      <button onClick={on.full} aria-label="Full screen" className="group grid size-11 shrink-0 place-items-center rounded-full">
        <span className="grid size-8 place-items-center rounded-full text-zinc-500 group-hover:bg-zinc-100 dark:text-zinc-400 dark:group-hover:bg-zinc-800">
          <Icon n="open" c="size-[18px]" />
        </span>
      </button>
      {more}
    </>
  ) : (
    more
  )
}

/** The phone's menu of a document: Copy, Move, Mark an area (not on a web page), Edit, and Delete last, red, asking
 * again before it deletes. */
export function docMenuSheet(code: string, f: { web: boolean; deleting: boolean }, on: { copy(): void; move(): void; mark(): void; edit(): void; remove(): void }): SheetParts {
  const row = (icon: IconName, label: string, onClick: () => void) => (
    <button onClick={onClick} className={`${MENU_ROW} h-11`}>
      <Icon n={icon} c="size-4 text-zinc-500 dark:text-zinc-400" />
      {label}
    </button>
  )
  return {
    menu: true,
    title: code,
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        {row('copy', 'Copy', on.copy)}
        {row('arrow', 'Move', on.move)}
        {f.web ? null : row('lasso', 'Mark an area', on.mark)}
        {row('pencil', 'Edit', on.edit)}
        <div className={MENU_SEP} />
        <button onClick={on.remove} className={`${MENU_ROW} h-11 ${DANGER} ${f.deleting ? 'font-semibold' : ''}`}>
          <Icon n="trash" c="size-4" />
          {f.deleting ? 'Delete?' : 'Delete'}
        </button>
      </div>
    ),
  }
}

/** A part of a document as a line to pick: a heading bold, a list's items apart, a table by its columns, code as code. */
function partLabel(b: Block): ReactNode {
  const cut = (s: string) => (s.length > 120 ? s.slice(0, 120) + '…' : s)
  if (b.kind === 'heading') return <b>{cut(oneLine(plainQuote(b.text)))}</b>
  if (b.kind === 'list') return cut(b.text.split('\n').map((l) => plainQuote(l).trim()).filter(Boolean).join(' · '))
  if (b.kind === 'table') return cut(`Table: ${b.text.split('\n')[0].split('|').map((s) => s.trim()).filter(Boolean).join(', ')}`)
  if (b.kind === 'code') return <code className="font-mono text-[13px]">{cut(oneLine(b.text.replace(/^```.*$/gm, '')))}</code>
  return cut(oneLine(plainQuote(b.text)))
}

/** Where in its document a comment goes: the whole document, or one of its paragraphs. */
export function commentMoveSheet(doc: Doc, current: string, onPick: (key: string) => void): SheetParts {
  const opt = (key: string, label: ReactNode) => (
    <button
      key={key}
      onClick={() => onPick(key)}
      {...(key === current ? { 'aria-current': 'true' as const } : {})}
      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <span className="line-clamp-2 min-w-0 flex-1">{label}</span>
      {key === current ? <CurrentMark /> : null}
    </button>
  )
  return {
    title: 'Move comment to…',
    body: (
      <div className="-mx-1 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto outline-none">
        {opt('doc', <b>Whole document</b>)}
        {/* each paragraph read as words (a table's cells, not its pipes) */}
        {doc.blocks.map((x) => opt(x.key, partLabel(x)))}
      </div>
    ),
  }
}
