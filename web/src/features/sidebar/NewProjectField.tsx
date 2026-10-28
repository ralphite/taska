// The sidebar's New project: a name (any name) and Create; Enter makes it, Esc stops. Props only.

import { useState } from 'react'
import { Icon } from '../../ui/Icon'
import { FIELD } from '../../ui/tones'

export function NewProjectField({ error, on }: { error: string; on: { create(title: string): void; cancel(): void } }) {
  const [name, setName] = useState('')
  return (
    <div className="mt-1 px-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              on.create(name)
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
              on.cancel()
            }
          }}
          className={`${FIELD} h-10 py-1.5 text-sm`}
          placeholder="Project name"
          aria-label="New project name"
          autoComplete="off"
          spellCheck={false}
        />
        <button onClick={() => on.create(name)} className="h-10 shrink-0 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          Create
        </button>
        <button onClick={on.cancel} aria-label="Cancel" className="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800">
          <Icon n="x" c="size-4" />
        </button>
      </div>
      <p hidden={!error} className="px-2 pt-1 text-xs text-red-600 dark:text-red-400">
        {error}
      </p>
    </div>
  )
}
