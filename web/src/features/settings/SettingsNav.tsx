// The way through Settings: on the desktop a column of its sections (the one open blue, the one under the pointer
// grey), with the way back, and Keyboard shortcuts at its foot; on the phone an index of rows, each saying how it is
// set now. Props only.

import { Kbd, pressedMark } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { ALL_PROJECTS, SECTIONS, type SectionKey } from './sectionList'
import { PH_GROUP, PhHead } from './SettingsParts'
import { MUTED } from '../../ui/tones'

export interface NavFacts {
  /** what each section's row says on its right */
  right: Partial<Record<SectionKey, string | number>>
}

export function DeskNav({ current, back, f, pressed = null, on }: { current: SectionKey; back: string; f: NavFacts; /** a section's row pressed (a finger on it) */ pressed?: SectionKey | null; on: { open(k: SectionKey): void; back(): void; keys(): void; href(k: SectionKey): string } }) {
  const row = (k: SectionKey) => (
    <a
      key={k}
      href={on.href(k)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return
        e.preventDefault()
        on.open(k)
      }}
      {...(k === current ? { 'aria-current': 'page' as const } : {})}
      {...pressedMark(k === pressed)}
      className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 data-pressed:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:text-blue-200"
    >
      <Icon n={SECTIONS[k].icon} c="size-4 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{SECTIONS[k].name}</span>
      <span className={`max-w-28 truncate text-xs font-normal tabular-nums ${MUTED}`}>{f.right[k] ?? ''}</span>
    </a>
  )
  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-2">
        <button onClick={on.back} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <Icon n="left" c="size-4" />
          Back to {back}
          <Kbd k="Esc" />
        </button>
      </div>
      <h1 className="px-4 pt-1 pb-3 text-[19px] font-semibold tracking-tight">Settings</h1>
      <div className="flex flex-col gap-0.5 px-2">{ALL_PROJECTS.map(row)}</div>
      <button
        onClick={on.keys}
        className="mt-auto flex h-12 shrink-0 items-center gap-2 border-t border-zinc-200 px-4 text-[13px] text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <Icon n="keyboard" c="size-4" />
        <span className="flex-1 text-left">Keyboard shortcuts</span>
        <Kbd k="?" />
      </button>
    </>
  )
}

export function PhoneIndex({ f, on }: { f: NavFacts; on: { open(k: SectionKey): void; back(): void; href(k: SectionKey): string } }) {
  const row = (k: SectionKey) => (
    <a
      key={k}
      href={on.href(k)}
      onClick={(e) => {
        e.preventDefault()
        on.open(k)
      }}
      className="flex min-h-12 items-center gap-3 px-3.5 py-2.5 text-[15px]"
    >
      <Icon n={SECTIONS[k].icon} c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="shrink-0">{SECTIONS[k].name}</span>
      <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
        <span className="truncate">{f.right[k] ?? ''}</span>
      </span>
      <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
    </a>
  )
  return (
    <>
      <PhHead title="Settings" onBack={on.back} />
      <div className={`${PH_GROUP} mt-3`}>{ALL_PROJECTS.map(row)}</div>
    </>
  )
}
