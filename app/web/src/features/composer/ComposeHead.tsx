// Over the New input page on the desktop: the project's tile and name. Props only.

import { ProjTile } from '../../ui/bits'

export function ComposeHead({ title, tone }: { title: string; tone: string }) {
  return (
    <div className="mx-auto mb-6 flex max-w-[42rem] flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <ProjTile title={title} tone={tone} cls="size-11 rounded-xl text-xl shadow-sm" />
        <h1 className="text-[28px] leading-none font-semibold tracking-tight">{title}</h1>
      </div>
    </div>
  )
}
