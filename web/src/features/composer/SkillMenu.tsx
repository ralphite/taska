// The skills to pick from in the input box (T821) and, when + opened it, the ways to add files above them (T834): a
// card over the box, a row each. Props only.

import type { Ref } from 'react'
import { fits, type Skill } from '../../model/skills'
import { Icon, type IconName } from '../../ui/Icon'

/** The skills that fit the "/" being typed (T821): each its name and what it is for; ↑↓ to choose, ↵ or ⇥ to take. */
/** A skill's name as Codex lists it, without its "/", the letters typed standing out. */
function SkillName({ name, typed }: { name: string; typed: string }) {
  const at = new Set(fits(name, typed) ?? [])
  return (
    <span className="shrink-0 text-zinc-900 dark:text-zinc-100">
      {[...name].map((c, i) => (i === 0 ? null : at.has(i) ? <b key={i} className="font-semibold">{c}</b> : c))}
    </span>
  )
}

/** The skills to pick from, as Codex shows its commands: a card over the box (under it on the desktop's New input
 * page, where the box is at the top), a row each: its name, what it is for. */
/** T834: a way to add files, at the top of +'s card */
export interface AddRow {
  label: string
  icon: IconName
  run(): void
}

export function SkillMenu({ menu, sel, typed, adds, cardRef, on }: { menu: readonly Skill[]; sel: number; typed: string; adds?: readonly AddRow[]; cardRef?: Ref<HTMLDivElement>; on: { pick(s: Skill): void; select(i: number): void } }) {
  return (
    <div
      ref={cardRef}
      role="listbox"
      aria-label={adds ? 'Add' : 'Skills'}
      className="absolute inset-x-0 bottom-full z-20 mb-2 flex max-h-[min(30rem,60dvh)] lg:max-h-80 lg:group-data-[compose]/app:top-full lg:group-data-[compose]/app:bottom-auto lg:group-data-[compose]/app:mt-2 lg:group-data-[compose]/app:mb-0 flex-col gap-px overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      {adds ? (
        // T834 r1436: + opens this card: the ways to add files first, each its own row (the phone: camera, photos,
        // files), the skills under them
        <>
          {adds.map((a, k) => (
            <button
              key={a.label}
              role="option"
              aria-selected={sel === -1 - k}
              onMouseMove={() => sel !== -1 - k && on.select(-1 - k)}
              onClick={a.run}
              className="flex min-h-11 w-full shrink-0 items-center gap-2.5 rounded-xl px-2.5 text-left text-[15px] text-zinc-900 aria-selected:bg-zinc-100 lg:min-h-8 lg:text-sm dark:text-zinc-100 dark:aria-selected:bg-zinc-800"
            >
              <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                <Icon n={a.icon} c="size-[18px] lg:size-4" />
              </span>
              {a.label}
            </button>
          ))}
          {menu.length ? <div className="mx-2.5 my-1 shrink-0 border-t border-zinc-200 dark:border-zinc-800" /> : null}
        </>
      ) : null}
      {menu.map((s, i) => (
        <button
          key={s.name}
          role="option"
          aria-selected={i === sel}
          onMouseDown={(e) => e.preventDefault()} // the words keep the caret
          onMouseMove={() => i !== sel && on.select(i)}
          onClick={() => on.pick(s)}
          className="flex min-h-11 w-full min-w-0 shrink-0 items-center gap-2.5 rounded-xl px-2.5 text-left text-[15px] aria-selected:bg-zinc-100 lg:min-h-8 lg:text-sm dark:aria-selected:bg-zinc-800"
        >
          <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
            <Icon n="book" c="size-[18px] lg:size-4" />
          </span>
          <SkillName name={s.name} typed={typed} />
          <span className="min-w-0 flex-1 truncate text-zinc-500 dark:text-zinc-400">{s.what}</span>
        </button>
      ))}
    </div>
  )
}
