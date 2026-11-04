// One way to comment on a place picked in a page (a paragraph, words selected, a part of a web page; B498): two
// buttons beside it, Voice and Comment. Voice turns them, where they are, into a small recording strip: ✕ at the far
// left cancels, the time and the level run, Voice becomes ✓ (stop: on the desktop the words go into the box below,
// at this place; on the phone, which has no box over a document, it is sent) and Comment becomes ↑ (send at once).
// Also the recording's time and level as the box shows them (RecBar). Props only.

import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/** A recording's red dot, its time and its level, as the box shows them. */
export function RecBar({ time, levels }: { time: string; levels: readonly number[] }) {
  return (
    <>
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      <span className="shrink-0 font-mono text-[15px] text-zinc-800 tabular-nums dark:text-zinc-100">{time}</span>
      <span className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden">
        {levels.map((l, i) => (
          <span key={i} className="w-[3px] shrink-0 rounded-full bg-zinc-500 dark:bg-zinc-400" style={{ height: Math.round(4 + l * 24) }} />
        ))}
      </span>
    </>
  )
}

export interface PlaceVoiceEvents {
  say(): void
  comment(): void
  cancel(): void
  /** ✓ */
  check(): void
  /** ↑ */
  send(): void
}

/** How many moments of the level the strip shows. */
export const PLACE_LEVELS = { desk: 6, phone: 12 } as const

// the page's small buttons beside a part
const SMALL = 'grid size-7 shrink-0 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white'
// the input box's buttons: plain, and the round dark one
const PLAIN = (phone: boolean) => `grid shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${phone ? 'size-11' : 'size-8'}`
const MAIN = (phone: boolean) => `grid shrink-0 place-items-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${phone ? 'size-11' : 'size-8'}`
const RING = 'grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-600 dark:hover:bg-zinc-800'

type Marks = Record<string, string>

function B({ icon, label, tip, cls, on, big, sw, marks }: { icon: IconName; label: string; tip?: string; cls: string; on(): void; big?: boolean; sw?: string; marks?: Marks }) {
  return (
    <button {...marks} aria-label={label} title={tip ?? label} onClick={on} className={cls}>
      <Icon n={icon} c={big ? 'size-5' : 'size-4'} sw={sw} />
    </button>
  )
}

/** Speaking: ✕ · the time and level · ✓ · ↑, where the two buttons were. */
function Strip({ phone, meter, marks, on }: { phone: boolean; meter: ReactNode; marks?: Marks; on: PlaceVoiceEvents }) {
  return (
    <>
      <B icon="x" label="Cancel" tip={phone ? 'Cancel' : 'Cancel · Esc'} cls={PLAIN(phone)} on={on.cancel} big={phone} />
      <span data-rec-time className={`flex items-center gap-1.5 ${phone ? 'min-w-0 flex-1' : 'w-28'}`}>
        {meter}
      </span>
      <B icon="check" label={phone ? 'Stop and post' : 'Stop: the words go into the box below'} cls={PLAIN(phone)} on={on.check} big={phone} sw="2.5" marks={marks} />
      <B icon="up" label="Stop and send" cls={MAIN(phone)} on={on.send} big={phone} sw="2.25" />
    </>
  )
}

/** The desktop's: two small buttons beside the place; speaking, the strip (it ends where they end). `say` and
 * `comment`: marks on those buttons (a web page's part names itself on them); `say`'s go on ✓ while it records. */
export function PlaceVoice({ rec, meter, say, comment, on }: { rec: boolean; meter?: ReactNode; say?: Marks; comment?: Marks; on: PlaceVoiceEvents }) {
  if (rec)
    return (
      <div data-place-rec role="status" aria-label="Recording" className="flex h-9 items-center gap-1 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
        <Strip phone={false} meter={meter} marks={say} on={on} />
      </div>
    )
  return (
    <div className="flex gap-1">
      <B icon="mic" label="Voice comment" cls={SMALL} on={on.say} marks={say} />
      <B icon="comment" label="Comment" cls={SMALL} on={on.comment} marks={comment} />
    </div>
  )
}

/** The phone's: a row under the place, made for a thumb; the same rules. */
export function PlaceVoiceRow({ rec, meter, say, comment, on }: { rec: boolean; meter?: ReactNode; say?: Marks; comment?: Marks; on: PlaceVoiceEvents }) {
  return (
    <div {...(rec ? { 'data-place-rec': '', role: 'status', 'aria-label': 'Recording' } : {})} className="flex h-12 items-center gap-2">
      {rec ? (
        <Strip phone meter={meter} marks={say} on={on} />
      ) : (
        <>
          <span className="min-w-0 flex-1 pl-2 text-[13px] text-zinc-500 dark:text-zinc-400">Speak or write about it</span>
          <B icon="mic" label="Voice comment" cls={`${MAIN(true)} shadow-lg`} on={on.say} big marks={say} />
          <B icon="comment" label="Comment" cls={RING} on={on.comment} big marks={comment} />
        </>
      )}
    </div>
  )
}
