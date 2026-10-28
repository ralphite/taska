// What Settings' sections are made of: a part with a title and a line about it, a setting with its control beside
// it, text in a box to copy, a switch, a ruled line, Loading; and the phone's own look (a page head with Back, grouped
// rows, labels and notes under them). Props only.

import type { ReactNode } from 'react'
import { Icon } from '../../ui/Icon'
import { PRIMARY, SECOND } from '../../ui/tones'

export const Part = ({ title, about, children, id }: { title: ReactNode; about?: ReactNode; children?: ReactNode; id?: string }) => (
  <section {...(id ? { id } : {})} className="scroll-mt-16 border-t border-zinc-200 py-6 lg:scroll-mt-6 dark:border-zinc-800">
    <h2 className="text-[15px] font-semibold">{title}</h2>
    {about ? <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{about}</p> : null}
    {children}
  </section>
)

export const Setting = ({ title, about, control }: { title: ReactNode; about: ReactNode; control: ReactNode }) => (
  <section className="flex items-center gap-6 border-t border-zinc-200 py-6 dark:border-zinc-800">
    <div className="min-w-0 flex-1">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{about}</p>
    </div>
    {control}
  </section>
)

/** Text to copy: no word cut in two, no backticks shown. */
export const TextBox = ({ t, mono = true }: { t: string; mono?: boolean }) => (
  <div className={`mt-3 rounded-xl bg-zinc-100 px-3.5 py-3 leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono text-[13px] break-words' : 'text-sm break-words'}`}>{mono ? t : t.replace(/`/g, '')}</div>
)

export const CopyBtn = ({ label, main = false, onCopy }: { label: string; main?: boolean; onCopy(): void }) => (
  <button onClick={onCopy} className={`${main ? PRIMARY : SECOND} mt-3`}>
    <Icon n="copy" c={main ? 'size-4.5' : 'size-4'} />
    {label}
  </button>
)

export const Ruled = ({ children }: { children: ReactNode }) => <div className="border-t border-zinc-200 dark:border-zinc-800">{children}</div>

export const Loading = () => (
  <Ruled>
    <p className="py-6 text-sm text-zinc-400">Loading…</p>
  </Ruled>
)

export const Toggle = ({ on, label, onToggle }: { on: boolean; label: string; onToggle(): void }) => (
  <button
    onClick={onToggle}
    aria-pressed={on}
    aria-label={label}
    className="group relative h-6.5 w-11 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:inset-x-0 after:-inset-y-[9px] hover:brightness-95 aria-pressed:bg-emerald-500 dark:bg-zinc-600 dark:hover:brightness-125"
  >
    <span className="absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow transition-transform group-aria-pressed:translate-x-4.5" />
  </button>
)

export const PH_GROUP = 'mx-3 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-800 dark:bg-zinc-900'

export const PhHead = ({ title, onBack }: { title: string; onBack(): void }) => (
  <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 bg-zinc-100/90 px-1 backdrop-blur dark:bg-zinc-950/90">
    <button onClick={onBack} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 dark:text-zinc-400">
      <Icon n="left" c="size-6" />
    </button>
    <h1 className="min-w-0 truncate text-[17px] font-semibold">{title}</h1>
  </header>
)

export const PhLabel = ({ children }: { children: ReactNode }) => <div className="flex min-w-0 items-center gap-1.5 px-5 pt-6 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{children}</div>

export const PhNote = ({ children }: { children: ReactNode }) => <p className="px-5 pt-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{children}</p>
