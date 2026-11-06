// Naming a new project, the same wherever it is asked (the sidebar, the home page, Settings), in a small popover on the
// desktop and a sheet on the phone titled New project (D115 #7): its tile as it will be, its name (any name), Create;
// Enter makes it, Esc stops; why it was not made under it. Props only.

import { useState } from 'react'
import { ProjTile } from './bits'
import { DISABLED, FIELD, PRIMARY } from './tones'

export function NewProjectForm({ error, tone, onCreate, onCancel }: {
  error: string
  /** the colour its tile will have, for the name typed */
  tone(name: string): string
  onCreate(title: string): void
  onCancel(): void
}) {
  const [name, setName] = useState('')
  const create = () => name.trim() && onCreate(name.trim())
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <ProjTile title={name.trim() || '?'} tone={name.trim() ? tone(name.trim()) : 'bg-zinc-300 dark:bg-zinc-600'} cls="size-11 rounded-xl text-lg lg:size-10" />
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
      </div>
      {error ? (
        <p role="alert" className="pt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end pt-4">
        <button onClick={create} disabled={!name.trim()} className={`${PRIMARY} phone:h-11 phone:w-full phone:justify-center ${DISABLED}`}>
          Create
        </button>
      </div>
    </div>
  )
}
