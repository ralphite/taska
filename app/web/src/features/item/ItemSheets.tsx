// Sheets about an item's talk: what the item came from (each input, with its words and files and what the organizer
// made of it), and a message's menu. Props only.

import type { ReactNode } from 'react'
import { when } from '../../model/time'
import type { FileRef, Input } from '../../model/types'
import { inputCode, whoName } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import type { SheetParts } from '../../ui/Sheet'
import { MENU_ROW } from '../../ui/tones'

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

/** A message's menu: hide it (it folds to one line). */
export function messageMenuSheet(onHide: () => void): SheetParts {
  return {
    menu: true,
    title: 'Message',
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        <button onClick={onHide} className={MENU_ROW}>
          <Icon n="shrink" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Hide (folds to one line)
        </button>
      </div>
    ),
  }
}
