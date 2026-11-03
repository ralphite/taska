// Naming a new project, the same wherever it is asked (the sidebar, the home page, Settings on the desktop and the
// phone): its name (any name), Create, and × to stop; Enter makes it, Esc stops; why it was not made under it. Props
// only.

import { useState } from 'react'
import { Icon } from './Icon'
import { DISABLED, FIELD } from './tones'

export function NewProjectForm({ value = '', error, onCreate, onCancel }: { value?: string; error: string; onCreate(title: string): void; onCancel(): void }) {
  const [name, setName] = useState(value)
  const create = () => name.trim() && onCreate(name.trim())
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              create()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
              onCancel()
            }
          }}
          className={`${FIELD} h-11 min-w-0 flex-1 py-2 lg:h-10 lg:py-1.5 lg:text-sm`}
          placeholder="Project name"
          aria-label="New project name"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={create}
          disabled={!name.trim()}
          className={`h-11 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-[15px] font-semibold text-white hover:bg-zinc-700 lg:h-10 lg:text-sm dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${DISABLED}`}
        >
          Create
        </button>
        <button onClick={onCancel} aria-label="Cancel" className="grid size-11 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 lg:size-10 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
          <Icon n="x" c="size-4" />
        </button>
      </div>
      {error ? (
        <p role="alert" className="px-1 pt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
