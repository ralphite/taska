// One of your views' menu: rename it, give it the filters shown now, delete it. Props only.

import type { SheetParts } from '../../ui/Sheet'
import { Icon, type IconName } from '../../ui/Icon'
import { DANGER, MENU_SEP } from '../../ui/tones'

export function viewMenuSheet(name: string, on: { rename(): void; update(): void; remove(): void }): SheetParts {
  const row = (icon: IconName, label: string, run: () => void, danger = false) => (
    <button onClick={run} className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm ${danger ? `${DANGER} hover:bg-red-50 dark:hover:bg-red-400/10` : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
      <Icon n={icon} c={`size-4 ${danger ? '' : 'text-zinc-500 dark:text-zinc-400'}`} />
      {label}
    </button>
  )
  return {
    title: name || 'View',
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        {row('pencil', 'Rename', on.rename)}
        {row('save', 'Use current filters', on.update)}
        <div className={MENU_SEP} />
        {row('trash', 'Delete', on.remove, true)}
      </div>
    ),
  }
}
