// The way through Settings: on the desktop a column of its sections (the one open blue, the one under the pointer
// grey), with the way back, and Keyboard shortcuts at its foot; on the phone an index of grouped rows, each saying
// how it is set now. Props only.

import { Kbd, ProjTile } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { ALL_PROJECTS, SECTIONS, THIS_PROJECT, type SectionKey } from './sectionList'
import { PH_GROUP, PhHead, PhLabel, PhNote } from './SettingsParts'

export interface NavFacts {
  title: string
  tone: string
  /** what each section's row says on its right */
  right: Partial<Record<SectionKey, string | number>>
  /** the agents' tone, for the phone's dot */
  agentTone: 'ok' | 'bad' | 'idle'
}

const AGENT_TONE = { ok: 'bg-emerald-500', bad: 'bg-red-500', idle: 'bg-zinc-300 dark:bg-zinc-600' } as const

export function DeskNav({ current, back, f, on }: { current: SectionKey; back: string; f: NavFacts; on: { open(k: SectionKey): void; back(): void; keys(): void; href(k: SectionKey): string } }) {
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
      className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 data-pressed:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:text-blue-200"
    >
      <Icon n={SECTIONS[k].icon} c="size-4 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{SECTIONS[k].name}</span>
      <span className="max-w-28 truncate text-xs font-normal text-zinc-400 tabular-nums dark:text-zinc-500">{f.right[k] ?? ''}</span>
    </a>
  )
  const group = (t: string) => <div className="px-3.5 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{t}</div>
  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-2">
        <button onClick={on.back} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <Icon n="left" c="size-4" />
          Back to {back}
          <Kbd k="Esc" />
        </button>
      </div>
      <h1 className="px-4 pt-1 text-[19px] font-semibold tracking-tight">Settings</h1>
      {group('This project')}
      <div className="flex items-center gap-2 px-3.5 pb-1.5">
        <ProjTile title={f.title} tone={f.tone} cls="size-5 rounded-md text-[11px]" />
        <span className="min-w-0 truncate text-sm font-semibold">{f.title}</span>
      </div>
      <div className="flex flex-col gap-0.5 px-2">{THIS_PROJECT.map(row)}</div>
      {group('All projects')}
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
        {k === 'agents' ? (
          <>
            <span className={`size-2 shrink-0 rounded-full ${AGENT_TONE[f.agentTone]}`} />
            <span className="truncate">{f.right.agents}</span>
          </>
        ) : (
          <span className="truncate">{f.right[k] ?? ''}</span>
        )}
      </span>
      <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
    </a>
  )
  return (
    <>
      <PhHead title="Settings" onBack={on.back} />
      <PhLabel>
        <span className="shrink-0">This project ·</span>
        <ProjTile title={f.title} tone={f.tone} cls="size-4 rounded text-[9px]" />
        <span className="truncate font-semibold text-zinc-700 dark:text-zinc-200">{f.title}</span>
      </PhLabel>
      <div className={PH_GROUP}>{THIS_PROJECT.map(row)}</div>
      <PhNote>Connect agents in Agents or from an agent pill.</PhNote>
      <PhLabel>All projects</PhLabel>
      <div className={PH_GROUP}>{ALL_PROJECTS.map(row)}</div>
      <PhNote>Create, rename, delete, or restore.</PhNote>
    </>
  )
}
