// The small parts every screen uses: key caps, project tiles, avatars, search marks, counts, section heads, what is
// still coming.

import { useState, type ReactNode } from 'react'
import { AVATAR_LETTER, plural } from '../model/words'
import { Icon, StateIcon, type IconName } from './Icon'
import { MUTED } from './tones'
import CLAUDE_CODE from './agent-icons/claude-code.png'
import CODEX from './agent-icons/codex.png'

const BONE = 'rounded-md bg-zinc-200 dark:bg-zinc-800'
const WIDE = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/12', 'w-7/12']

/** What is still coming, as pale rows shaped like it, so nothing jumps when it comes: a list's items (a mark and two
 * lines), rows with a tile (projects), or lines of words. Read out as Loading. */
export function Skeleton({ shape, n = 3, cls = '' }: { shape: 'item' | 'tile' | 'text'; n?: number; cls?: string }) {
  return (
    <div role="status" aria-label="Loading" className={`animate-pulse ${cls}`}>
      {Array.from({ length: n }, (_, i) =>
        shape === 'item' ? (
          <div key={i} className="flex h-16 items-start gap-3 border-b border-zinc-100 py-2.5 pr-3 pl-4 dark:border-zinc-800/70">
            <span className={`mt-0.5 size-5 shrink-0 ${BONE} rounded-full`} />
            <span className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
              <span className={`h-3.5 ${BONE} ${WIDE[i % WIDE.length]}`} />
              <span className={`h-3 w-16 ${BONE}`} />
            </span>
          </div>
        ) : shape === 'tile' ? (
          <div key={i} className="flex h-11 items-center gap-3 px-3">
            <span className={`size-6 shrink-0 ${BONE}`} />
            <span className={`h-3.5 ${BONE} ${WIDE[i % WIDE.length]}`} />
          </div>
        ) : (
          <div key={i} className="flex h-6 items-center">
            <span className={`h-3.5 ${BONE} ${i === n - 1 ? 'w-2/5' : i % 2 ? 'w-11/12' : 'w-full'}`} />
          </div>
        ),
      )}
    </div>
  )
}

/** A key cap, shown on the desktop only. */
export function Kbd({ k }: { k: string }) {
  return (
    <kbd className="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold ring-1 ring-current/30 lg:inline-grid">
      {k}
    </kbd>
  )
}

/** A project's tile: its first letter on its colour. */
export function ProjTile({ title, tone, cls = 'size-5 rounded-md text-[11px]' }: { title: string; tone: string; cls?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center leading-none font-bold text-white uppercase ${cls} ${tone}`}>
      {[...String(title || '?')][0]}
    </span>
  )
}

/** The agents drawn by their app's own icon (64 px copies of the apps' icons); the others keep their letter. */
const AGENT_ICON: Record<string, string> = { 'claude-code': CLAUDE_CODE, codex: CODEX }

/** An agent's mark: its app's icon, else its letter; `dot` (a dot's colour) sits on its corner. */
export function Avatar({ by, dot }: { by: string; dot?: string }) {
  const src = AGENT_ICON[by]
  const mark = src ? (
    // Codex's tile is near black: a faint edge keeps it apart from a dark page
    <img src={src} alt="" draggable={false} className={`size-5 shrink-0 rounded-md select-none ${by === 'codex' ? 'dark:ring-1 dark:ring-white/15' : ''}`} />
  ) : (
    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
      {AVATAR_LETTER[by] || String(by || '?')[0].toUpperCase()}
    </span>
  )
  if (!dot) return mark
  return (
    <span className="relative flex shrink-0">
      {mark}
      <span className="absolute -top-1 -right-1 rounded-full bg-white p-0.5 dark:bg-zinc-950">
        <span className={`block size-2 rounded-full ${dot}`} />
      </span>
    </span>
  )
}

/** The searched words, marked where they show. */
export function Hit({ text, words }: { text: string; words: readonly string[] }) {
  if (!words.length || !text) return <>{text}</>
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i')
  const parts = text.split(re)
  return (
    <>
      {parts.map((s, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-400/30">
            {s}
          </mark>
        ) : (
          s
        ),
      )}
    </>
  )
}

export const Soft = ({ children }: { children: ReactNode }) => (
  <span className="rounded bg-zinc-100 px-1.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{children}</span>
)

export const Count = ({ icon, n, label }: { icon: IconName; n: ReactNode; label: string }) => (
  <span className="flex items-center gap-1" title={label}>
    <Icon n={icon} c="size-3.5" />
    {n}
  </span>
)

/** Items need you here: the Needs you status mark alone (the rows' own drawing, smaller); how many is in its tip
 * (B664: the mark says it, no number or words beside it). */
export const NeedsCount = ({ n }: { n: number }) => {
  const said = `${plural(n, 'item')} ${n === 1 ? 'needs' : 'need'} you`
  return (
    <span data-needs title={said} aria-label={said} className="flex shrink-0 items-center">
      <StateIcon s="wait" cls="size-3.5" />
    </span>
  )
}

/** The choice that is set now, in every menu and picker: a blue ✓ at the row's end (as Status and Later have it). */
export const CurrentMark = () => <Icon n="check" c="size-4 shrink-0 text-blue-600 dark:text-blue-400" sw="2.5" />

export const DraftMark = () => (
  <span data-draft className="inline-flex shrink-0 items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
    <Icon n="pencil" c="size-3" sw="2.25" />
    Draft
  </span>
)

export const SectionHead = ({ text, right }: { text: ReactNode; right?: ReactNode }) => (
  <div className="flex h-6 items-center justify-between">
    <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{text}</h2>
    {right}
  </div>
)

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="px-6 py-16 text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</div>
)

/** A picture in its frame: a spinner while it loads, the picture sign if it cannot load (never a broken mark). */
export function Pic({ src, alt = '', cls = '' }: { src: string; alt?: string; cls?: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  return (
    <span className="relative grid size-full place-items-center">
      <img
        {...(state === 'loading' ? {} : { [state === 'loaded' ? 'data-loaded' : 'data-failed']: '' })}
        src={src}
        alt={alt}
        loading="lazy"
        className={`${cls} ${state === 'failed' ? 'invisible' : ''}`}
        onLoad={() => setState('loaded')}
        onError={() => setState('failed')}
      />
      {state === 'loading' ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        </span>
      ) : state === 'failed' ? (
        <span className={`pointer-events-none absolute inset-0 grid place-items-center ${MUTED}`}>
          <Icon n="image" c="size-5" />
        </span>
      ) : null}
    </span>
  )
}
