// Sheets about what you said: an input's menu (Edit, Add more, its original words, Undo organizing, Move to…,
// History, Put with an item…, Take off a file, Delete), its versions, a voice note's original words. Props only.

import type { ReactNode } from 'react'
import { when } from '../../model/time'
import type { FileRef, Input } from '../../model/types'
import { inputCode } from '../../model/words'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import type { SheetParts } from '../../ui/Sheet'
import { MENU_ROW } from '../../ui/tones'

export interface InputMenuEvents {
  edit(): void
  append(): void
  asSaid(f: string): void
  undo(): void
  move(): void
  history(): void
  rescope(): void
  takeOff(f: string): void
  remove(): void
}

export interface InputMenuFacts {
  r: Input
  /** its voice notes' original words can be seen (their words were tidied) */
  tidy: boolean
  undo: { tip: string } | null
  move: boolean
  history: boolean
  /** "Put with another item (now F12)…" */
  scope: string | null
  /** the file whose Take off waits for its second click */
  asking: string | null
  deleteTip: string
}

export function inputMenuSheet({ r, tidy, undo, move, history, scope, asking, deleteTip }: InputMenuFacts, on: InputMenuEvents): SheetParts {
  const row = (key: string, icon: IconName, label: ReactNode, run: () => void, tip = '') => (
    <button key={key} onClick={run} {...(tip ? { title: tip } : {})} className={MENU_ROW}>
      <Icon n={icon} c="size-4 text-zinc-500 dark:text-zinc-400" />
      {label}
    </button>
  )
  return {
    menu: true,
    title: inputCode(r.id),
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        {row('edit', 'pencil', 'Edit', on.edit)}
        {row('append', 'plus', 'Add more', on.append)}
        {tidy ? r.files.filter((f) => (f.mime || '').startsWith('audio/')).map((f) => row('said' + f.f, 'quote', 'Original words', () => on.asSaid(f.f))) : null}
        {undo ? row('undo', 'undo', 'Undo organizing', on.undo, undo.tip) : null}
        {move ? row('move', 'arrow', 'Move to…', on.move, 'Sent to the wrong project?') : null}
        {history ? row('history', 'history', 'History', on.history) : null}
        {row('rescope', 'scope', scope ? `Put with another item (now ${scope})…` : 'Put with an item…', on.rescope)}
        {r.files.map((f: FileRef) => (
          <button key={f.f} onClick={() => on.takeOff(f.f)} className={MENU_ROW}>
            <Icon n="x" c="size-4 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1 truncate">{asking === f.f ? 'Take it off?' : `Take off ${f.name || 'a file'}`}</span>
          </button>
        ))}
        {row('delete', 'trash', 'Delete', on.remove, deleteTip)}
      </div>
    ),
  }
}

/** An input's versions: as it is now, then each before it, the oldest last. */
export function historySheet(r: Input, now: number): SheetParts {
  const h = r.history || []
  const versions = [{ text: r.text, t: r.updated || r.t, label: 'Current' }, ...h.map((x, i) => ({ ...x, t: i ? h[i - 1].t : r.t, label: i ? `Version ${i + 1}` : 'Original' })).reverse()]
  return {
    title: `${inputCode(r.id)} history`,
    body: (
      <>
        {versions.map((v, i) => (
          <section key={i} className="mb-5">
            <h3 className="mb-2 text-sm font-semibold">
              {v.label}
              <span className="ml-2 font-normal text-zinc-400">{when(v.t, now)}</span>
            </h3>
            <p className="text-[15px] break-words whitespace-pre-wrap">{v.text}</p>
          </section>
        ))}
      </>
    ),
  }
}

/** A voice note's words as said, before they were tidied. */
export function asSaidSheet(heard: string, tr: string): SheetParts {
  return {
    menu: true,
    title: 'Original words',
    body: (
      <>
        <p className="text-[15px] break-words whitespace-pre-wrap">{heard || tr || 'No words were heard.'}</p>
        {heard ? null : <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nothing was tidied in this one: the words are as said.</p>}
      </>
    ),
  }
}
