// The New input page (desktop): what is in the box shows at the top of "You said" as a Draft card, lined up with the
// inputs under it, while a voice note's words are there to check or pick from. Props only.

import type { ReactNode } from 'react'
import { clock } from '../../model/time'
import { plural } from '../../model/words'
import { Kbd } from '../../ui/bits'
import { Icon } from '../../ui/Icon'

export type DraftHint =
  /** misheard words not picked yet */
  | { kind: 'check'; n: number }
  /** all picked: the other one can still be had */
  | { kind: 'switch' }
  /** a voice note's words are in it: they can be corrected */
  | { kind: 'fix' }
  | null

export const DRAFT_WORDS = 'mt-1 w-full rounded-2xl rounded-tl-md border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-[15px] leading-8 break-words whitespace-pre-wrap text-zinc-900 dark:border-blue-400/40 dark:bg-blue-400/5 dark:text-zinc-100'

export function DraftCard({ voice, ms, files, transcribing, words, hint }: { voice: number; ms: number; files: number; transcribing: boolean; /** the words, with the versions to pick from; none yet: null */ words: ReactNode; hint: DraftHint }) {
  return (
    <li className="group/row relative border-b border-zinc-100 py-3 dark:border-zinc-800/70">
      <div className="min-w-0">
        <div className="flex h-7 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold tracking-wider text-blue-700 uppercase dark:text-blue-300">Draft</span>
          <span>· not sent</span>
          {voice ? (
            <span className="flex items-center gap-1">
              · <Icon n="mic" c="size-3.5" />
              <span className="font-mono tabular-nums">{clock(ms)}</span> voice note{voice > 1 ? 's' : ''}
            </span>
          ) : null}
          {files ? <span>· {plural(files, 'file')}</span> : null}
          <span className="ml-auto flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
            <Kbd k="⇧↵" />
            <span>send</span>
          </span>
        </div>
        {words ?? (
          <div className={DRAFT_WORDS}>
            <span className="text-zinc-400 dark:text-zinc-500">{transcribing ? 'Transcribing…' : 'No words yet'}</span>
          </div>
        )}
        {hint ? (
          <div className="mt-2 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
            <p className="flex items-start gap-1.5">
              {hint.kind === 'check' ? <Icon n="alert" c="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" sw="2" /> : <Icon n="pencil" c="mt-px size-3.5 shrink-0" />}
              <span>
                {hint.kind === 'check' ? (
                  <b className="font-semibold text-zinc-700 dark:text-zinc-200">{plural(hint.n, 'word')} to check</b>
                ) : hint.kind === 'switch' ? (
                  'Click the other version to switch before sending.'
                ) : (
                  'Select words to correct spelling. Taska remembers.'
                )}
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </li>
  )
}
