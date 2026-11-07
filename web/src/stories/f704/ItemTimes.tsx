// F704 prototype: when an item was made and when it last changed, in the three directions Gemini proposed
// (scratchpad brief, r1143). Only for the stories: the item page itself is unchanged; `Placed` puts the line into the
// real page where each direction wants it.
//   a. "Subtle metadata": a quiet line under the title, before the chips; a tap opens it in place, a pointer shows a tip
//   b. "Native sheet": a line under the chips; a tap opens a sheet with both times, a pointer shows a tip
//   c. "Inline popover": "Nov 3 · 2h ago" at the end of the chips' row; a tap or a pointer opens a small card

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { agoShort } from '../../model/agents'
import { dayShort, when } from '../../model/time'
import { whoName } from '../../model/words'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { MUTED } from '../../ui/tones'

export type Way = 'a' | 'b' | 'c'

export interface Times {
  t0: string
  t1: string
  /** who made it: you, the organizer or an agent */
  by: string | null
  now: number
}

/** "2h ago" within the week, then the day ("Oct 21"). */
const ago = (t: string, now: number) => {
  const ms = now - Date.parse(t)
  if (ms < 60e3) return 'just now'
  return ms < 7 * 864e5 ? `${agoShort(Date.parse(t), now)} ago` : dayShort(t)
}
/** The page's own time words, today's said as such ("Today 14:38"). */
const exact = (t: string, now: number) => {
  const w = when(t, now)
  return /^\d/.test(w) ? `Today ${w}` : w
}
const byWho = (by: string | null) => (!by ? '' : by === 'you' ? 'by you' : `by ${whoName(by)}`)
const same = (x: Times) => x.t0 === x.t1
const tipText = (x: Times) => [`Created ${exact(x.t0, x.now)} ${byWho(x.by)}`.trim(), same(x) ? '' : `Updated ${exact(x.t1, x.now)}`].filter(Boolean).join('\n')

const LINE = `text-[13px] leading-5 ${MUTED}`
const DOT = <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
// the page's tooltip, drawn where it would show (the stories' "pointed at" state)
const TIP = 'absolute top-full left-0 z-30 mt-1.5 w-max max-w-[260px] rounded-lg bg-zinc-900 px-2 py-1.5 text-[13px] leading-snug whitespace-pre-line text-white shadow-lg shadow-black/20 dark:bg-zinc-100 dark:text-zinc-900'

/** a. Under the title: "Created Nov 3 by Organizer · Updated 2h ago"; tapped, both times in full on two lines. */
function UnderTitle({ x, desk, open: start }: { x: Times; desk: boolean; open: boolean }) {
  const [open, setOpen] = useState(start)
  const full = open && !desk
  return (
    <div className="relative -mt-1.5">
      <button title={desk ? tipText(x) : undefined} onClick={() => !desk && setOpen(!open)} className={`-my-2 py-2 text-left ${LINE}`}>
        {full ? (
          <span className="flex flex-col">
            <span>Created {exact(x.t0, x.now)} {byWho(x.by)}</span>
            {same(x) ? null : <span>Updated {exact(x.t1, x.now)}</span>}
          </span>
        ) : (
          <>
            Created {dayShort(x.t0)} {byWho(x.by)}
            {same(x) ? null : (
              <>
                {DOT}Updated {ago(x.t1, x.now)}
              </>
            )}
          </>
        )}
      </button>
      {open && desk ? <div className={TIP}>{tipText(x)}</div> : null}
    </div>
  )
}

/** b. Under the chips: "Nov 3 by Organizer · Updated 2h ago"; tapped, a sheet with both times. */
function UnderChips({ x, desk, open: start }: { x: Times; desk: boolean; open: boolean }) {
  const [open, setOpen] = useState(start)
  const row = (label: string, t: string, who: string) => (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <span className={MUTED}>{label}</span>
      <span className="text-right">
        <span className="block font-medium tabular-nums">{exact(t, x.now)}</span>
        {who ? <span className={`block text-[13px] ${MUTED}`}>{who}</span> : null}
      </span>
    </div>
  )
  return (
    <div className="relative">
      <button title={desk ? tipText(x) : undefined} onClick={() => !desk && setOpen(true)} className={`-my-2 py-2 text-left ${LINE}`}>
        {dayShort(x.t0)} {byWho(x.by)}
        {same(x) ? null : (
          <>
            {DOT}Updated {ago(x.t1, x.now)}
          </>
        )}
      </button>
      {open && desk ? <div className={TIP}>{tipText(x)}</div> : null}
      {desk ? null : (
        <Sheet open={open} look={{}} desk={false} onClose={() => setOpen(false)}>
          <SheetLayout
            title="Times"
            body={
              <div className="divide-y divide-zinc-100 pb-2 text-[15px] dark:divide-zinc-800">
                {row('Created', x.t0, byWho(x.by))}
                {same(x) ? null : row('Last updated', x.t1, '')}
              </div>
            }
          />
        </Sheet>
      )}
    </div>
  )
}

/** c. At the end of the chips' row: "Nov 3 · 2h ago"; tapped or pointed at, a small card with both times. */
function ChipRowEnd({ x, desk, open: start }: { x: Times; desk: boolean; open: boolean }) {
  const [open, setOpen] = useState(start)
  const [over, setOver] = useState(false)
  const shown = open || over
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        onPointerEnter={() => desk && setOver(true)}
        onPointerLeave={() => desk && setOver(false)}
        className={`flex h-8 items-center rounded-lg px-1.5 tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800 ${LINE}`}
      >
        {dayShort(x.t0)}
        {same(x) ? null : (
          <>
            {DOT}
            {ago(x.t1, x.now)}
          </>
        )}
      </button>
      {shown ? (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-56 rounded-xl bg-white p-3 text-[13px] shadow-lg ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10">
          <div className="flex flex-col gap-2.5">
            <div>
              <div className={`text-[11px] font-medium uppercase ${MUTED}`}>Created</div>
              <div className="font-medium tabular-nums">{exact(x.t0, x.now)}</div>
              {x.by ? <div className={MUTED}>{byWho(x.by)}</div> : null}
            </div>
            {same(x) ? null : (
              <div>
                <div className={`text-[11px] font-medium uppercase ${MUTED}`}>Updated</div>
                <div className="font-medium tabular-nums">{exact(x.t1, x.now)}</div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

const PARTS = { a: UnderTitle, b: UnderChips, c: ChipRowEnd }

/** The real item page (`children`) with the times where the direction puts them: (a) between the title and the chips,
 * (b) after the chips, (c) as the last thing in the chips' row, pushed to its right. `open`: as tapped (the phone) or
 * pointed at (the desktop). */
export function Placed({ way, x, desk, open = false, children }: { way: Way; x: Times; desk: boolean; open?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const title = ref.current?.querySelector('[data-part="item-title"]')
    const chips = title?.nextElementSibling
    if (!title || !chips) return
    const h = document.createElement('div')
    if (way === 'a') title.after(h)
    else if (way === 'b') chips.after(h)
    else {
      h.className = 'relative ml-auto'
      chips.append(h)
    }
    setHost(h)
    return () => h.remove()
  }, [way])
  const Part = PARTS[way]
  return (
    <div ref={ref} className="contents">
      {children}
      {host ? createPortal(<Part x={x} desk={desk} open={open} />, host) : null}
    </div>
  )
}
