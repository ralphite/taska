// A Storybook section's own page: what goes in it, and when it leaves. Props only.
import type { ReactNode } from 'react'

export function SectionAbout({ name, children, note }: { name: string; children: ReactNode; note: ReactNode }) {
  return (
    <div className="max-w-xl text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200 [&>p]:mb-3">
      <h1 className="mb-3 text-xl font-semibold">{name}</h1>
      {children}
      <p className="text-zinc-500 dark:text-zinc-400">{note}</p>
    </div>
  )
}
