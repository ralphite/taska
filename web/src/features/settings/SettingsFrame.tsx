// Settings' page: on the desktop its column of sections and the section beside it (its name and what it is for over
// it); on the phone its index, or one section's page (its name with the way back, what it is for, and the section in
// a card; Projects lays itself out). Props only: the sections and their bodies come in drawn.

import type { ReactNode, Ref } from 'react'
import { SECTIONS, type SectionKey } from './sectionList'
import { PhHead } from './SettingsParts'

export function SettingsFrame({ desk, sec, title, place, prefs = false, paneRef, nav, body, onBack }: {
  desk: boolean
  /** the section open (the phone: none is its index) */
  sec: SectionKey | null
  /** the project's name, for what the section is for */
  title: string
  place: string
  /** the transcription preferences are edited in the box under it: room for it */
  prefs?: boolean
  paneRef?: Ref<HTMLDivElement>
  nav: ReactNode
  body: ReactNode
  onBack(): void
}) {
  const k = sec ?? 'agents'
  return (
    <section
      data-part="settings"
      aria-label="Settings"
      className={`flex min-h-0 flex-1 flex-col bg-zinc-100 lg:flex-row lg:overflow-hidden lg:bg-transparent dark:bg-zinc-950 dark:lg:bg-transparent ${place}`}
    >
      <nav
        hidden={!desk && !!sec}
        aria-label="Sections of Settings"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-10 lg:w-60 lg:flex-none lg:shrink-0 lg:scrollbar-thin lg:border-r lg:border-zinc-200 lg:pb-4 dark:lg:border-zinc-800"
      >
        {nav}
      </nav>
      <div
        ref={paneRef}
        hidden={!desk && !sec}
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain lg:scrollbar-gutter-both lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${prefs ? 'pb-64' : ''}`}
      >
        {!desk ? (
          sec ? (
            <>
              <PhHead title={SECTIONS[sec].name} onBack={onBack} />
              <p className="px-5 pt-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">{SECTIONS[sec].about(title)}</p>
              {sec === 'projects' ? body : <div className="mx-3 mt-4 rounded-2xl bg-white px-4 dark:bg-zinc-900 [&>:first-child]:border-t-0 [&>:last-child]:border-b-0">{body}</div>}
              <div className="h-10" />
            </>
          ) : null
        ) : (
          <div className="mx-auto w-full max-w-[46rem] px-8 pt-9 pb-16">
            <header className="pb-6">
              <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{SECTIONS[k].name}</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{SECTIONS[k].about(title)}</p>
            </header>
            {body}
          </div>
        )}
      </div>
    </section>
  )
}
