// The files waiting in the box's draft: a voice note (its length and whether its words came), a picture, a file;
// faded until it is up; each with a way to take it out. Props only.

import { clock } from '../../model/time'
import { Icon } from '../../ui/Icon'

export interface DraftFile {
  key: string
  f: string
  name: string
  mime?: string
  preview?: string
  /** a voice note's length, ms */
  ms?: number
  tr?: string
  transcribing?: boolean
  retrying?: boolean
  more?: boolean
  trError?: string
}

const voiceWord = (f: DraftFile) =>
  f.transcribing
    ? f.retrying
      ? 'Retrying…'
      : 'Transcribing…'
    : f.more
      ? 'May be cut short · fuller words on the way'
      : f.tr
        ? 'Transcribed'
        : f.trError
          ? 'No transcript: the audio goes as it is'
          : 'No words heard: the audio goes as it is'

export function DraftFiles({ files, url, onRemove, onView }: { files: readonly DraftFile[]; url(f: string): string; onRemove(key: string): void; onView(key: string): void }) {
  return (
    <div hidden={!files.length} className="flex gap-2.5 overflow-x-auto px-3 pt-3 pb-1 lg:scrollbar-thin">
      {files.map((f) => (
        <div key={f.key} className="relative shrink-0">
          {(f.mime || '').startsWith('audio/') ? (
            <div className="flex h-16 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              <Icon n="mic" c="size-4" />
              <span className="font-mono tabular-nums">{clock(f.ms || 0)}</span>
              <span
                className={`font-semibold ${f.transcribing ? 'animate-pulse text-blue-600 dark:text-blue-400' : f.more ? 'max-w-40 leading-snug text-amber-700 dark:text-amber-400' : f.tr ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}
              >
                {voiceWord(f)}
              </span>
            </div>
          ) : (f.mime || '').startsWith('image/') ? (
            <button onClick={() => onView(f.key)} aria-label={`Look at ${f.name}`} className="block cursor-zoom-in rounded-xl">
              <img src={f.preview || url(f.f || '')} alt="" className={`size-16 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}`} />
            </button>
          ) : (
            <div className={`flex h-16 w-28 items-center gap-1 rounded-xl border border-zinc-200 px-2 text-xs dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}`}>
              <Icon n="file" c="size-4" />
              <span className="line-clamp-2 break-all">{f.name}</span>
            </div>
          )}
          <button onClick={() => onRemove(f.key)} aria-label={`Remove ${f.name}`} className="absolute -top-3.5 -right-3.5 grid size-11 place-items-center">
            <span className="grid size-6 place-items-center rounded-full bg-zinc-900 text-white ring-2 ring-white dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900">
              <Icon n="x" c="size-3.5" sw="2.5" />
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}
