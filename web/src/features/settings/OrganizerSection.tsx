// Settings' Organizer: whether it runs, and the Gemini API key it needs (F765). Props only.

import { useState } from 'react'
import type { GeminiKey } from '../../model/types'
import { FIELD, PRIMARY, SECOND } from '../../ui/tones'
import { Part } from './SettingsParts'

export interface GeminiKeyEvents {
  /** keep this key (Google checks it first); Taska restarts to use it */
  save(key: string): void
  /** forget the key set here */
  forget(): void
}

/** The organizer, and the Gemini API key it needs (F765): none (where to get one, and a box to paste it in), set here
 * (its last 4 characters; change or remove), or from the environment (change sets one here). Saving: the box waits
 * while Google checks it and Taska restarts. */
export function OrganizerBody({ on, model, gemini = { from: '', tail: '' }, saving = false, events }: { on: boolean; model: string; gemini?: GeminiKey; saving?: boolean; events?: GeminiKeyEvents }) {
  const [changing, setChanging] = useState(false)
  const [key, setKey] = useState('')
  const box = !gemini.from || changing
  const save = () => key.trim() && events?.save(key.trim())
  return (
    <>
      {on ? <Part title="On" about={`Gemini (${model}) files inputs into items in all projects; undo it on the input`} /> : <Part title="Off" about="Inputs stay as you send them and voice notes are not written out." />}
      <Part
        title="Gemini API key"
        about={
          box ? (
            <>
              Free from{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                Google AI Studio
              </a>
              . Kept on this computer only.
            </>
          ) : gemini.from === 'env' ? (
            `From GEMINI_API_KEY · ••••${gemini.tail}`
          ) : (
            `••••${gemini.tail}`
          )
        }
      >
        {box ? (
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your key"
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
              aria-label="Gemini API key"
              className={`${FIELD} min-w-0 flex-1 basis-56 font-mono`}
            />
            <button type="submit" disabled={saving || !key.trim()} className={PRIMARY}>
              {saving ? 'Checking…' : 'Save'}
            </button>
            {changing ? (
              <button type="button" onClick={() => (setChanging(false), setKey(''))} disabled={saving} className={SECOND}>
                Cancel
              </button>
            ) : null}
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setChanging(true)} className={SECOND}>
              Change
            </button>
            {gemini.from === 'settings' ? (
              <button onClick={() => events?.forget()} disabled={saving} className={SECOND}>
                Remove
              </button>
            ) : null}
          </div>
        )}
      </Part>
    </>
  )
}
