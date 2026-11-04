// The New input page (desktop): what is in the box shows over the inputs as a Draft card (T661), while a voice note's
// words are there to check or pick from: Draft, how long the voice note is, how many words to check, send; the words
// under a line. Props only.

import type { ReactNode } from 'react'
import { clock } from '../../model/time'
import { plural } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { BUSY, MUTED } from '../../ui/tones'

export type DraftHint =
  /** misheard words not picked yet */
  | { kind: 'check'; n: number }
  /** a voice note's words are in it: they can be corrected */
  | { kind: 'fix' }
  | null

export const DRAFT_WORDS = 'text-[14.5px] leading-relaxed break-words whitespace-pre-wrap text-zinc-900 dark:text-zinc-100'

export function DraftCard({ voice, ms, files, transcribing, words, hint, onSend }: {
  voice: number
  ms: number
  files: number
  transcribing: boolean
  /** the words, with the versions to pick from; none yet: null */
  words: ReactNode
  hint: DraftHint
  /** sends it, as the box's Send (⇧↵) */
  onSend(): void
}) {
  return (
    <section aria-label="Draft" className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/30">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-amber-200/80 pb-2 text-xs dark:border-amber-800/60">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-900 uppercase dark:bg-amber-900/80 dark:text-amber-200">Draft</span>
          {voice ? (
            <span className="flex items-center gap-1 font-mono text-[11px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">
              <Icon n="mic" c="size-3" sw="2" />
              {clock(ms)} voice note{voice > 1 ? 's' : ''}
            </span>
          ) : null}
          {files ? <span className="font-mono text-[11px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">{plural(files, 'file')}</span> : null}
        </div>
        <div className="flex min-w-0 items-center gap-2.5">
          {hint?.kind === 'check' ? (
            <span className="text-xs font-medium whitespace-nowrap text-amber-800 dark:text-amber-300">{plural(hint.n, 'word')} to check</span>
          ) : hint?.kind === 'fix' ? (
            <span className={`truncate ${MUTED}`}>Select words to correct spelling. Taska remembers.</span>
          ) : null}
          {/* Send only with words to send */}
          {words && !transcribing ? (
            <button onClick={onSend} title="Send · ⇧↵" className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-amber-500">
              <span>send</span>
              <kbd className="font-mono text-[9px] opacity-80">⇧↵</kbd>
            </button>
          ) : null}
        </div>
      </div>
      {words ?? (
        <div className={DRAFT_WORDS}>
          <span className={transcribing ? BUSY : MUTED}>{transcribing ? 'Transcribing…' : 'No words yet'}</span>
        </div>
      )}
    </section>
  )
}
