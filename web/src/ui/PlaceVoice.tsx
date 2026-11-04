// One way to comment on a place picked in a page (a paragraph, words selected, a part of a web page; B498): two
// buttons beside it, Voice and Comment. Voice turns them, where they are, into a small recording strip: ✕ at the far
// left cancels, the time and the level run, Voice becomes ✓. On the desktop ✓ stops it and its words go into the box
// below, at this place, and Comment becomes ↑ (send at once). Where ✓ already adds (an input's row, T661) there is
// no ↑. On the phone, which has no box over a document, ✓ sends it, so there is no ↑ either (r1062). With no ↑ its
// room stays empty, so ✓ is still where Voice was.
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
  /** ↑ (none: ✓ is all, as on an input's row) */
  send?(): void
}

/** What the buttons say (their tips), where a place says it its own way: an input's row, "Comment on #12". */
export interface PlaceVoiceLabels {
  say?: string
  comment?: string
  check?: string
}

/** How many moments of the level the strip shows. */
export const PLACE_LEVELS = { desk: 6, phone: 12 } as const

// the page's small buttons beside a part (and beside them, a part's own ⋯)
export const PLACE_BUTTON =
  'grid size-7 shrink-0 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white'
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

/** Speaking: ✕ · the time and level · ✓ · ↑ (the desktop's), where the two buttons were. */
function Strip({ phone, meter, marks, check, on }: { phone: boolean; meter: ReactNode; marks?: Marks; check?: string; on: PlaceVoiceEvents }) {
  return (
    <>
      <B icon="x" label="Cancel" tip={phone ? 'Cancel' : 'Cancel · Esc'} cls={PLAIN(phone)} on={on.cancel} big={phone} />
      <span data-rec-time className={`flex items-center gap-1.5 ${phone ? 'min-w-0 flex-1' : 'w-28'}`}>
        {meter}
      </span>
      {/* the phone's ✓ sends: the dark round button Voice was */}
      <B icon="check" label={check ?? (phone ? 'Stop and post' : 'Stop: the words go into the box below')} cls={phone ? MAIN(true) : PLAIN(false)} on={on.check} big={phone} sw="2.5" marks={marks} />
      {on.send ? <B icon="up" label="Stop and send" cls={MAIN(phone)} on={on.send} big={phone} sw="2.25" /> : null}
    </>
  )
}

/** The desktop's: two small buttons beside the place; speaking, the strip (it ends where they end). `say` and
 * `comment`: marks on those buttons (a web page's part names itself on them); `say`'s go on ✓ while it records. */
export function PlaceVoice({ rec, meter, say, comment, labels = {}, on }: { rec: boolean; meter?: ReactNode; say?: Marks; comment?: Marks; labels?: PlaceVoiceLabels; on: PlaceVoiceEvents }) {
  if (rec)
    return (
      // no ↑: its room (and the gap before it) kept outside the strip, so ✓ is where Voice was
      <div data-place-rec role="status" aria-label="Recording" className={`flex h-9 items-center gap-1 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10 ${on.send ? '' : 'mr-9'}`}>
        <Strip phone={false} meter={meter} marks={say} check={labels.check} on={on} />
      </div>
    )
  return (
    <div className="flex gap-1">
      <B icon="mic" label={labels.say ?? 'Voice comment'} cls={PLACE_BUTTON} on={on.say} marks={say} />
      <B icon="comment" label={labels.comment ?? 'Comment'} cls={PLACE_BUTTON} on={on.comment} marks={comment} />
    </div>
  )
}

/** The phone's: a row under the place, made for a thumb; speaking, ✕ and ✓, which sends (no ↑, r1062). */
export function PlaceVoiceRow({ rec, meter, say, comment, on }: { rec: boolean; meter?: ReactNode; say?: Marks; comment?: Marks; on: Omit<PlaceVoiceEvents, 'send'> }) {
  return (
    // speaking, Comment's room (and the gap before it) stays empty, so ✓ is where Voice was
    <div {...(rec ? { 'data-place-rec': '', role: 'status', 'aria-label': 'Recording' } : {})} className={`flex h-12 items-center gap-2 ${rec ? 'pr-13' : ''}`}>
      {rec ? (
        <Strip phone meter={meter} marks={say} on={{ ...on, send: undefined }} />
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
