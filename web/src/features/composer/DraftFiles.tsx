// The files waiting in the box's draft: a voice note (its length and whether its words came), a picture, a file;
// faded while it goes up, red once Taska refused it (model/fileStates); each with a way to take it out. Props only.

import { FILE_STATES, fileState, type FileState } from '../../model/fileStates'
import { clock } from '../../model/time'
import { noteState, sayIn, type NoteFields, type VoiceTone } from '../../model/voiceStates'
import { FileName } from '../../ui/Files'
import { Icon } from '../../ui/Icon'

export interface DraftFile extends NoteFields {
  key: string
  f: string
  name: string
  preview?: string
  /** a voice note's length, ms */
  ms?: number
}

/** how each tone of a voice note's words looks in its chip */
const TONE: Record<VoiceTone, string> = {
  busy: 'animate-pulse text-blue-600 dark:text-blue-400',
  partial: 'max-w-40 leading-snug text-amber-700 dark:text-amber-400',
  done: 'text-emerald-600 dark:text-emerald-400',
  quiet: 'text-zinc-500',
  failed: 'text-red-600 dark:text-red-400',
}

/** how a picture or a file looks in each upload state: faded going up, its edge red once refused */
const EDGE: Record<FileState, string> = {
  uploading: 'border-zinc-200 opacity-40 dark:border-zinc-700',
  up: 'border-zinc-200 dark:border-zinc-700',
  failed: 'border-red-400 dark:border-red-500/70',
}

/** refused: said in red under a file's name; on a picture, its mark in its corner, the words in its tip (a voice note
 * says it in its own words) */
const Failed = ({ over }: { over: boolean }) =>
  over ? (
    <span title={FILE_STATES.failed.say} aria-label={FILE_STATES.failed.say} className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-red-600 text-white ring-2 ring-white dark:bg-red-500 dark:ring-zinc-900">
      <Icon n="alert" c="size-3" sw="2.5" />
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
      <Icon n="alert" c="size-3 shrink-0" />
      {FILE_STATES.failed.say}
    </span>
  )

/** a voice note's words, as its state says them in the chip (model/voiceStates) */
function NoteWord({ f }: { f: DraftFile }) {
  const s = sayIn(noteState(f), 'chip')
  return s ? <span className={`font-semibold ${TONE[s.tone]}`}>{s.say}</span> : null
}

export function DraftFiles({ files, url, onRemove, onView }: { files: readonly DraftFile[]; url(f: string): string; onRemove(key: string): void; onView(key: string): void }) {
  return (
    <div hidden={!files.length} className="flex gap-2.5 overflow-x-auto px-3 pt-3 pb-1 lg:scrollbar-thin">
      {files.map((f) => {
        const up = fileState(f)
        return (
        <div key={f.key} className="relative shrink-0">
          {(f.mime || '').startsWith('audio/') ? (
            // a voice note says where it is in its words (never faded); refused, its edge red as any file's
            <div className={`flex h-16 items-center gap-2 rounded-xl border px-3 text-xs text-zinc-600 dark:text-zinc-300 ${up === 'failed' ? EDGE.failed : EDGE.up}`}>
              <Icon n="mic" c="size-4" />
              <span className="font-mono tabular-nums">{clock(f.ms || 0)}</span>
              <NoteWord f={f} />
            </div>
          ) : (f.mime || '').startsWith('image/') ? (
            <button onClick={() => onView(f.key)} aria-label={`Look at ${f.name}`} className="relative block cursor-zoom-in rounded-xl hover:brightness-95 dark:hover:brightness-110">
              <img src={f.preview || url(f.f || '')} alt="" className={`size-16 rounded-xl border object-cover ${EDGE[up]}`} />
              {up === 'failed' ? <Failed over /> : null}
            </button>
          ) : (
            <div className={`flex h-16 w-36 items-center gap-1.5 rounded-xl border px-2.5 text-xs ${EDGE[up]}`}>
              <Icon n="file" c="size-4 shrink-0" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <FileName name={f.name} />
                {up === 'failed' ? <Failed over={false} /> : null}
              </span>
            </div>
          )}
          <button onClick={() => onRemove(f.key)} aria-label={`Remove ${f.name}`} className="group/x absolute -top-3.5 -right-3.5 grid size-11 place-items-center">
            <span className="grid size-6 place-items-center rounded-full bg-zinc-900 text-white ring-2 ring-white group-hover/x:bg-zinc-600 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900 dark:group-hover/x:bg-white">
              <Icon n="x" c="size-3.5" sw="2.5" />
            </span>
          </button>
        </div>
        )
      })}
    </div>
  )
}
