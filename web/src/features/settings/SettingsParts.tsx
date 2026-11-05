// What Settings' sections are made of: a part with a title and a line about it, a setting with its control beside
// it, text in a box to copy, a switch, a ruled line, Loading; and the phone's own look (a page head with Back, grouped
// rows, labels and notes under them). Props only.

import type { ReactNode } from 'react'
import { Icon } from '../../ui/Icon'
import { DISABLED, PRIMARY } from '../../ui/tones'
import { Skeleton } from '../../ui/bits'

export const Part = ({ title, about, children }: { title: ReactNode; about?: ReactNode; children?: ReactNode }) => (
  <section className="scroll-mt-16 border-t border-zinc-200 py-6 lg:scroll-mt-6 dark:border-zinc-800">
    <h2 className="text-[15px] font-semibold">{title}</h2>
    {about ? <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{about}</p> : null}
    {children}
  </section>
)

export const Setting = ({ title, about, control }: { title: ReactNode; about: ReactNode; control: ReactNode }) => (
  <section className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-zinc-200 py-6 dark:border-zinc-800">
    <div className="min-w-0 flex-1 basis-48">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{about}</p>
    </div>
    {control}
  </section>
)

/** Text to copy: no word cut in two, no backticks shown. */
export const TextBox = ({ t }: { t: string }) => (
  <div className="mt-3 rounded-xl bg-zinc-100 px-3.5 py-3 font-mono text-[13px] leading-relaxed break-words text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">{t}</div>
)

export const CopyBtn = ({ label, onCopy }: { label: string; onCopy(): void }) => (
  <button onClick={onCopy} className={`${PRIMARY} mt-3`}>
    <Icon n="copy" c="size-4.5" />
    {label}
  </button>
)

export const Ruled = ({ children }: { children: ReactNode }) => <div className="border-t border-zinc-200 dark:border-zinc-800">{children}</div>

export const Loading = () => (
  <Ruled>
    <Skeleton shape="text" cls="py-4" />
  </Ruled>
)

export const Toggle = ({ on, label, onToggle, disabled = false }: { on: boolean; label: string; onToggle(): void; /** of no use now: greyed, not to be pressed */ disabled?: boolean }) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    aria-pressed={on}
    aria-label={label}
    className={`group relative h-6.5 w-11 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:inset-x-0 after:-inset-y-[9px] hover:brightness-95 aria-pressed:bg-emerald-500 disabled:hover:brightness-100 dark:bg-zinc-600 dark:hover:brightness-125 ${DISABLED}`}
  >
    <span className="absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow transition-transform group-aria-pressed:translate-x-4.5" />
  </button>
)

/** A time of day to pick, shown as its words: a tap opens the browser's own time picker. */
const TimeAt = ({ label, value, onPick }: { label: string; value: string; onPick(v: string): void }) => (
  <input
    type="time"
    aria-label={label}
    value={value}
    onChange={(e) => e.target.value && onPick(e.target.value)}
    className="h-8 rounded-md bg-transparent px-1 text-sm font-medium text-blue-600 tabular-nums outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:bg-zinc-800 [&::-webkit-calendar-picker-indicator]:hidden"
  />
)

/** Quiet hours: the switch at its title's right as every setting has it, from when to when on a line of their own
 * under it, each time a tap away from changing (D115 #43); one line about it, the desktop's and the phone's. */
export const QuietHoursSetting = ({ on, hours, events }: { on: boolean; hours: { from: string; to: string }; events: { toggle(): void; hours(h: { from: string; to: string }): void } }) => (
  <section className="border-t border-zinc-200 py-6 dark:border-zinc-800">
    <div className="flex items-center gap-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">Quiet hours</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">Alerts wait until it ends, in your local time.</p>
      </div>
      <Toggle on={on} label="Quiet hours" onToggle={events.toggle} />
    </div>
    <div className={`mt-2 -ml-1 flex items-center text-sm ${on ? '' : 'opacity-50'}`}>
      <TimeAt label="Quiet from" value={hours.from} onPick={(from) => events.hours({ ...hours, from })} />–
      <TimeAt label="Quiet until" value={hours.to} onPick={(to) => events.hours({ ...hours, to })} />
    </div>
  </section>
)

export const PH_GROUP ='mx-3 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-800 dark:bg-zinc-900'

export const PhHead = ({ title, onBack }: { title: string; onBack(): void }) => (
  <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 bg-zinc-100/90 px-1 backdrop-blur dark:bg-zinc-950/90">
    <button onClick={onBack} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 dark:text-zinc-400">
      <Icon n="left" c="size-6" />
    </button>
    <h1 className="min-w-0 truncate text-[17px] font-semibold">{title}</h1>
  </header>
)

export const PhLabel = ({ children }: { children: ReactNode }) => <div className="flex min-w-0 items-center gap-1.5 px-5 pt-6 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{children}</div>
