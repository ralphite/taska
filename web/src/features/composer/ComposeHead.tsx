// Over the New input page on the desktop: the project's tile and name, at the column's left edge (T661). Props only.

import { ProjTile } from '../../ui/bits'

export function ComposeHead({ title, tone }: { title: string; tone: string }) {
  return (
    <div className="mx-auto mb-5 flex max-w-[660px] items-center gap-2.5 select-none">
      <ProjTile title={title} tone={tone} cls="size-7 rounded text-xs shadow-xs" />
      <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h1>
    </div>
  )
}
