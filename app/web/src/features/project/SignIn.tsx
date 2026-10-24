// Taska wants its key: one sign-in in the page, not a page of its own; the page stays where it was. Props only.

import { useState } from 'react'
import type { SheetParts } from '../../ui/Sheet'
import { FIELD, PRIMARY } from '../../ui/tones'

function SignInForm({ onSignIn }: { onSignIn(key: string, field: HTMLInputElement | null): void }) {
  const [key, setKey] = useState('')
  const [field, setField] = useState<HTMLInputElement | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">From outside this computer&apos;s network, Taska asks for its key once on each device. It is in the link Settings › Use on your phone gives.</p>
      <input
        ref={setField}
        type="password"
        autoComplete="current-password"
        placeholder="Key"
        aria-label="Taska's key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSignIn(key, field)
        }}
        className={FIELD}
      />
      <button onClick={() => onSignIn(key, field)} className={PRIMARY}>
        Sign in
      </button>
    </div>
  )
}

export function signInSheet(onSignIn: (key: string, field: HTMLInputElement | null) => void): SheetParts {
  return { title: 'Key required', body: <SignInForm onSignIn={onSignIn} /> }
}
