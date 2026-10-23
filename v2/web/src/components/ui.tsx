// The small parts every screen uses: icons, state icons, key caps, project tiles, avatars, rich text, search marks.
import type { ReactNode } from 'react'
import { ICON, STATE_ICON, type IconName } from '../lib/icons'
import { AVATAR, STATUS } from '../lib/constants'
import { desk, projTone, searchWords, titleFor } from '../lib/state'
import { armed } from '../lib/dialog'

export function Icon({ n, c = 'size-5', sw = '1.75' }: { n: IconName; c?: string; sw?: string }) {
  return (
    <svg
      className={`${c} shrink-0`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON[n] }}
    />
  )
}
export function StateIcon({
  s,
  label = (STATUS as Record<string, string>)[s],
  cls = 'mt-px size-5',
  tone,
}: {
  s: string
  label?: string
  cls?: string
  tone?: string
}) {
  const [path, t] = STATE_ICON[s] || STATE_ICON.open
  return (
    <svg
      className={`${cls} shrink-0 ${tone ?? t}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: `<title>${label ?? ''}</title>${path}` }}
    />
  )
}
export function Kbd({ k }: { k: string }) {
  return (
    <kbd className="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold opacity-70 ring-1 ring-current/30 lg:inline-grid">
      {k}
    </kbd>
  )
}
export function ProjTile({ name, cls = 'size-5 rounded-md text-[11px]' }: { name: string; cls?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center leading-none font-bold text-white uppercase ${cls} ${projTone(name)}`}
    >
      {[...String(titleFor(name) || '?')][0]}
    </span>
  )
}
export function Avatar({ by }: { by: string }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
      {AVATAR[by] || String(by || '?')[0].toUpperCase()}
    </span>
  )
}
/** T274 #35, F227: the searched words, marked where they show. */
export function Hit({ text, words = searchWords() }: { text: string; words?: string[] }) {
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
export const Cnt = ({ icon, n, label }: { icon: IconName; n: ReactNode; label: string }) => (
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
/** A button that asks for a second click (B127, B131) says so in its own words while it waits. */
export const Armed = ({ k, ask, children }: { k: string; ask: string; children: ReactNode }) => (
  <>{armed(k) ? ask : children}</>
)
export const again = (what: string) => `${desk() ? 'Click' : 'Tap'} again${what}`

/** D82 #8: a picture in its frame: a spinner while it loads, and if it cannot load the picture sign in its place (the
 * frame's tip keeps its name), never the browser's broken mark; the same as a document's pictures (lib/markdown.ts).
 * lib/dims.ts marks the img data-loaded or data-failed. */
export function Pic({ src, alt = '', cls = '' }: { src: string; alt?: string; cls?: string }) {
  return (
    <span className="group/pic relative grid size-full place-items-center">
      <img data-pic src={src} alt={alt} loading="lazy" className={`${cls} data-failed:invisible`} />
      <span className="pointer-events-none absolute inset-0 grid place-items-center group-has-[img[data-failed]]/pic:hidden group-has-[img[data-loaded]]/pic:hidden">
        <span className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
      </span>
      <span className="pointer-events-none absolute inset-0 hidden place-items-center text-zinc-400 group-has-[img[data-failed]]/pic:grid dark:text-zinc-500">
        <Icon n="image" c="size-5" />
      </span>
    </span>
  )
}
