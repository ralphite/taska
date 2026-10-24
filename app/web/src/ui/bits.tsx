// The small parts every screen uses: key caps, project tiles, avatars, search marks, counts, section heads.

import { useState, type ReactNode } from 'react'
import { AVATAR_LETTER } from '../model/words'
import { Icon, type IconName } from './Icon'

/** A key cap, shown on the desktop only. */
export function Kbd({ k }: { k: string }) {
  return (
    <kbd className="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold opacity-70 ring-1 ring-current/30 desk:inline-grid">
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

/** An agent's mark. */
export function Avatar({ by }: { by: string }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
      {AVATAR_LETTER[by] || String(by || '?')[0].toUpperCase()}
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

export const DraftMark = ({ small = false }: { small?: boolean }) => (
  <span data-draft className="inline-flex shrink-0 items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
    <Icon n="pencil" c={small ? 'size-2.5' : 'size-3'} sw="2.25" />
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
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-zinc-400 dark:text-zinc-500">
          <Icon n="image" c="size-5" />
        </span>
      ) : null}
    </span>
  )
}
