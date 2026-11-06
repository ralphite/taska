// Sheets about what you said: an input's menu (Send, for a recording kept as cancelled; Edit, Add more, its original words, Undo organizing, Move to…,
// History, Put with an item…, Take off a file, Delete: red and last, it asks again in place, B666), its versions, a voice
// note's original words. Props only.

import type { ReactNode } from 'react'
import { when } from '../../model/time'
import type { FileRef, Input } from '../../model/types'
import { inputCode } from '../../model/words'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import type { SheetParts } from '../../ui/Sheet'
import { DANGER, MENU_ROW, MENU_SEP, MUTED } from '../../ui/tones'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'

export interface InputMenuEvents {
  send(): void
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
  /** a recording kept as cancelled: Send sends it after all, and it is put with no item until then (B627) */
  send: boolean
  /** Original words for each voice note (the phone: the desktop shows them under the pointer) */
  tidy: boolean
  undo: { tip: string } | null
  move: boolean
  history: boolean
  /** "Put with an item… · now F12" */
  scope: string | null
  /** the file whose Take off waits for its second click */
  asking: string | null
  /** Delete asked once: it says Delete? until the second click (or a moment passes) */
  deleting: boolean
  deleteTip: string
}

export function inputMenuSheet({ r, send, tidy, undo, move, history, scope, asking, deleting, deleteTip }: InputMenuFacts, on: InputMenuEvents): SheetParts {
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
        {send ? row('send', 'up', 'Send', on.send) : null}
        {row('edit', 'pencil', 'Edit', on.edit)}
        {row('append', 'plus', 'Add more', on.append)}
        {tidy ? r.files.filter((f) => (f.mime || '').startsWith('audio/')).map((f) => row('said' + f.f, 'quote', 'Original words', () => on.asSaid(f.f))) : null}
        {undo ? row('undo', 'undo', 'Undo organizing', on.undo, undo.tip) : null}
        {move ? row('move', 'arrow', 'Move to…', on.move) : null}
        {history ? row('history', 'history', 'History', on.history) : null}
        {send ? null : row('rescope', 'scope', scope ? `Put with an item… · now ${scope}` : 'Put with an item…', on.rescope)}
        {r.files.map((f: FileRef) => (
          <button key={f.f} onClick={() => on.takeOff(f.f)} className={`${MENU_ROW} ${asking === f.f ? DANGER : ''}`}>
            <Icon n="x" c={`size-4 ${asking === f.f ? '' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span className="min-w-0 flex-1 truncate">{asking === f.f ? 'Take it off?' : `Take off ${f.name || 'a file'}`}</span>
          </button>
        ))}
        <div className={MENU_SEP} />
        <button onClick={on.remove} {...(deleteTip ? { title: deleteTip } : {})} className={`${MENU_ROW} ${DANGER} hover:bg-red-50 dark:hover:bg-red-400/10`}>
          <Icon n="trash" c="size-4" />
          {deleting ? 'Delete?' : 'Delete'}
        </button>
      </div>
    ),
  }
}

/** An input's versions: as it is now, then each before it, the oldest last. */
/** `world`: what its words' codes and pictures are (they read as Markdown, as text everywhere does, r1099) */
export function historySheet(r: Input, now: number, world: InlineWorld): SheetParts {
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
              <span className={`ml-2 font-normal ${MUTED}`}>{when(v.t, now)}</span>
            </h3>
            <Rich text={v.text} world={world} cls="text-[15px]" />
          </section>
        ))}
      </>
    ),
  }
}

/** A voice note's words: word for word, then tidied (what the organizer and agents get), F568. */
export function asSaidSheet(heard: string, tr: string): SheetParts {
  const both = !!heard && !!tr && heard !== tr
  const part = (label: string, text: string) => (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-semibold">{label}</h3>
      <p className="text-[15px] break-words whitespace-pre-wrap">{text}</p>
    </section>
  )
  return {
    menu: true,
    title: 'Original words',
    body: both ? (
      <>
        {part('Word for word', heard)}
        {part('Tidied · what agents get', tr)}
      </>
    ) : (
      <>
        <p className="text-[15px] break-words whitespace-pre-wrap">{heard || tr || 'No words heard'}</p>
        {heard || tr ? <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Not tidied: words as said</p> : null}
      </>
    ),
  }
}
