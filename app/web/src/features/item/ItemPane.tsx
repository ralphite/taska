// An item's page: its title and fields, its text, and its talk. Props only.

import { shownStatus } from '../../model/items'
import { codeOf, type ProjectModel } from '../../model/project'
import type { Item } from '../../model/types'
import { whoName } from '../../model/words'
import { StateIcon } from '../../ui/Icon'
import { PRI_TEXT, TYPE_TEXT } from '../../ui/tones'

export function ItemPane({ it, model }: { it: Item; model: ProjectModel; slug: string }) {
  const code = codeOf(model, it.n)
  const st = shownStatus(it)
  return (
    <div className="px-4 pt-4 desk:px-8">
      <div className="flex items-center gap-2 text-sm">
        <StateIcon {...st} />
        <span className={`font-mono font-bold ${TYPE_TEXT[it.type]}`}>{code}</span>
        <span className="text-zinc-500 dark:text-zinc-400">{st.label}</span>
        <span className={PRI_TEXT[it.pri]}>{it.pri}</span>
      </div>
      <h1 className="mt-2 text-xl font-semibold">{it.title}</h1>
      {it.body ? <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">{it.body}</p> : null}
      <ol className="mt-6 flex flex-col gap-3">
        {it.thread.map((m) => (
          <li key={m.id} className={m.by === 'you' ? 'ml-8 rounded-xl bg-blue-100/80 px-3 py-2 dark:bg-blue-900/40' : 'mr-8 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800'}>
            <div className="text-xs font-medium text-zinc-500">{m.by === 'you' ? 'You' : whoName(m.by)}</div>
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.text}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
