// Sheets about what you said and what agents wrote: an input's menu (Edit, Add more, its original words, Undo
// organizing, Move to…, History, Put with an item…, Take off a file, Delete), its versions, what an item came
// from, a voice note's original words, a message's menu, a comment's new place in its document. Props only.

import type { ReactNode } from 'react'
import { oneLine } from '../../model/items'
import { when } from '../../model/time'
import type { Doc, FileRef, Input } from '../../model/types'
import { inputCode, whoName } from '../../model/words'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import type { SheetParts } from '../../ui/Sheet'

const ROW = 'flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800'

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
    <button key={key} onClick={run} {...(tip ? { title: tip } : {})} className={ROW}>
      <Icon n={icon} c="size-4 text-zinc-500 dark:text-zinc-400" />
      {label}
    </button>
  )
  return {
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
          <button key={f.f} onClick={() => on.takeOff(f.f)} className={ROW}>
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

/** What an item came from: each input, with its words and files and what the organizer made of it. */
export function sourcesSheet({ code, inputs, world, now, files }: { code: string; inputs: Input[]; world: InlineWorld; now: number; files(f: FileRef[]): ReactNode }, goInput: (id: string) => void): SheetParts {
  return {
    title: `What ${code} came from`,
    body: (
      <div className="flex flex-col gap-4">
        {inputs.length ? (
          inputs.map((r) => (
            <div key={r.id}>
              <div className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                <button onClick={() => goInput(r.id)} className="font-mono text-blue-600 hover:underline dark:text-blue-400">
                  {inputCode(r.id)}
                </button>{' '}
                · {when(r.t, now)} · {whoName(r.by)}
              </div>
              <div className="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed dark:bg-blue-400/10">
                {r.text ? <Rich text={r.text} world={world} /> : null}
                {r.files.length ? <div className="mt-2 flex items-end gap-2 overflow-x-auto lg:scrollbar-thin">{files(r.files)}</div> : null}
              </div>
              {r.org ? (
                <div className="mt-1.5 flex items-center gap-1 px-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <Icon n="sparkle" c="size-3.5" />
                  {r.org.msg}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No sources.</p>
        )}
      </div>
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

/** A message's menu: hide it (it folds to one line). */
export function messageMenuSheet(onHide: () => void): SheetParts {
  return {
    title: 'Message',
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        <button onClick={onHide} className={ROW}>
          <Icon n="shrink" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Hide (folds to one line)
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
    title: 'Move the comment to…',
    body: (
      <div className="-mx-1 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
        {opt('doc', <b>The whole document</b>)}
        {doc.blocks.map((x) => opt(x.key, oneLine(x.text).slice(0, 120)))}
      </div>
    ),
  }
}
