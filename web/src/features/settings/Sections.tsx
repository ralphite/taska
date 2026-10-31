// What each section of Settings shows: Projects (new, rename, delete, the deleted ones restored or deleted for good),
// Use on your phone (the link and the key), Notifications, Voice spellings and the transcription preferences, the
// Organizer. Props only.

import { useState, type ReactNode } from 'react'
import type { Spelling, VoicePrefs } from '../../model/types'
import { plural } from '../../model/words'
import { Kbd, ProjTile } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { FIELD, P_BTN, PRIMARY, SECOND } from '../../ui/tones'
import { Empty } from '../../ui/bits'
import { CopyBtn, Loading, Part, Ruled, Setting, TextBox, Toggle } from './SettingsParts'

// ---- Projects

export interface ProjectRowFacts {
  name: string
  title: string
  tone: string
  open: number
  here: boolean
}

export interface GoneProject {
  name: string
  title: string
  when: string
  items: number
}

export interface ProjectsFacts {
  live: ProjectRowFacts[] | null
  gone: GoneProject[]
  file: string
  pNew: boolean
  pNewText: string
  pErr: string
  renaming: string | null
  /** the deleted projects whose Delete forever waits for its second click */
  purging: ReadonlySet<string>
  /** the phone's row whose actions are open */
  menu: string | null
}

export interface ProjectsEvents {
  newProject(on: boolean): void
  create(title: string): void
  rename(slug: string | null): void
  saveRename(slug: string, title: string, was: string): void
  remove(slug: string): void
  restore(slug: string): void
  purge(slug: string): void
  menu(key: string): void
  open(slug: string): void
}

export function NameField({ value, label, cls, onEnter, onEsc, onValue, select = false }: { value: string; label: string; cls: string; onEnter(v: string): void; onEsc(): void; onValue?(v: string): void; select?: boolean }) {
  const [v, setV] = useState(value)
  return (
    <input
      autoFocus
      onFocus={(e) => select && e.currentTarget.select()}
      className={`${FIELD} ${cls}`}
      value={v}
      onChange={(e) => {
        setV(e.target.value)
        onValue?.(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          onEnter(v)
        }
        if (e.key === 'Escape') {
          e.stopPropagation()
          onEsc()
        }
      }}
      placeholder={label === 'New project name' ? 'Project name' : undefined}
      aria-label={label}
      autoComplete="off"
      spellCheck={false}
    />
  )
}

const goneTile = (title: string) => (
  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-400 text-sm leading-none font-bold text-white uppercase dark:bg-zinc-600">
    {[...String(title || '?')][0]}
  </span>
)

export function ProjectsBody({ f, on }: { f: ProjectsFacts; on: ProjectsEvents }) {
  const [name, setName] = useState(f.pNewText)
  if (!f.live) return <Loading />
  const add = f.pNew ? (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <NameField value={f.pNewText} label="New project name" cls="h-10 py-1.5 text-sm" onValue={setName} onEnter={(v) => on.create(v)} onEsc={() => on.newProject(false)} />
        <button onClick={() => on.create(name)} className="h-10 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          Create
        </button>
        <button onClick={() => on.newProject(false)} aria-label="Cancel" className="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Icon n="x" c="size-4" />
        </button>
      </div>
      {f.pErr ? (
        <p className="px-1 text-xs text-red-600 dark:text-red-400">{f.pErr}</p>
      ) : (
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Kbd k="↵" /> create and open it · <Kbd k="Esc" /> cancel
        </p>
      )}
    </div>
  ) : (
    <button onClick={() => on.newProject(true)} className={`${SECOND} shrink-0`}>
      <Icon n="plus" c="size-4" sw="2" />
      New project
    </button>
  )
  return (
    <>
      <section className="flex items-center gap-4 border-t border-zinc-200 py-5 dark:border-zinc-800">{add}</section>
      <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {f.live.map((p) => {
          const ren = f.renaming === p.name
          return (
            <li key={p.name} className="flex min-h-16 items-center gap-3 py-3">
              <ProjTile title={p.title} tone={p.tone} cls="size-8 rounded-lg text-sm" />
              <div className="min-w-0 flex-1">
                {ren ? (
                  <>
                    <NameField value={p.title} label={`New name for ${p.title}`} cls="h-10 max-w-[22rem] py-1.5 text-[15px] font-medium" select onEnter={(v) => on.saveRename(p.name, v, p.title)} onEsc={() => on.rename(null)} />
                    <p className="mt-1.5 flex items-center gap-1 px-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <Kbd k="↵" />
                      <span>save ·</span>
                      <Kbd k="Esc" />
                      <span>
                        cancel · the address stays <code className="font-mono">/p/{p.name}</code>
                      </span>
                    </p>
                  </>
                ) : (
                  <a
                    href={`/p/${encodeURIComponent(p.name)}/`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) return
                      e.preventDefault()
                      on.open(p.name)
                    }}
                    className="block rounded-lg hover:opacity-80"
                  >
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{p.title}</span>
                      {p.here ? <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">This project</span> : null}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      /p/{p.name} · {p.open} open{p.here && f.file ? ` · ${f.file}` : ''}
                    </p>
                  </a>
                )}
              </div>
              {ren ? null : (
                <>
                  <button onClick={() => on.rename(p.name)} className={P_BTN}>
                    <Icon n="pencil" c="size-4" />
                    Rename
                  </button>
                  <button onClick={() => on.remove(p.name)} className={P_BTN}>
                    <Icon n="trash" c="size-4" />
                    Delete
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {f.gone.length ? (
        <section className="pt-8">
          <h2 className="text-[15px] font-semibold">Deleted projects</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">A deleted project leaves the sidebar and stops giving work to agents. Nothing in it is lost: Restore brings it back as it was.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {f.gone.map((d) => (
              <li key={d.name} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900">
                {goneTile(d.title)}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium break-words text-zinc-600 dark:text-zinc-300">{d.title}</p>
                  <p className="text-xs break-words text-zinc-500 dark:text-zinc-400">
                    Deleted {d.when} · {plural(d.items, 'item')} · <span className="font-mono">/p/{d.name}</span>
                  </p>
                </div>
                <button onClick={() => on.restore(d.name)} className={P_BTN}>
                  <Icon n="undo" c="size-4" sw="2" />
                  Restore
                </button>
                <button onClick={() => on.purge(d.name)} className={`${P_BTN} hover:text-red-600 dark:hover:text-red-400`}>
                  {f.purging.has(d.name) ? "Click again: it can't be undone" : 'Delete forever'}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Delete forever asks for a second click. It is the only step that cannot be undone.</p>
        </section>
      ) : null}
    </>
  )
}

// ---- Use on your phone

export function PhoneBody({ link, keyText, asking, desk, on }: { link: string; keyText: string; asking: boolean; desk: boolean; on: { copy(t: string): void; newKey(): void } }) {
  return (
    <>
      {link ? (
        <Part title="Link" about="Open this on your phone to use Taska anywhere.">
          <TextBox t={link} />
          <CopyBtn label="Copy link" main onCopy={() => on.copy(link)} />
        </Part>
      ) : (
        <Part
          title="Link"
          about={
            <>
              Taska has no public address yet (start it with <code className="font-mono whitespace-nowrap">--public</code>). On the same network your phone needs no key.
            </>
          }
        />
      )}
      <Part title="On the Home Screen" about="iPhone: Share › Add to Home Screen. Android: Menu › Install app. Taska then runs full screen and can record voice notes." />
      <Part title="Key" about={`${link ? 'Or enter' : 'Enter'} this key once on the device.`}>
        <div className="mt-3 flex items-center gap-4">
          <span className="font-mono text-2xl tracking-wider select-all">{keyText}</span>
          <button onClick={() => on.copy(keyText)} className={SECOND}>
            <Icon n="copy" c="size-4" />
            Copy key
          </button>
        </div>
      </Part>
      <Setting
        title="New key"
        about="This computer and devices on its network need no key. A new key signs out all other devices."
        control={
          <button
            onClick={on.newKey}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-400/10"
          >
            {asking ? `${desk ? 'Click' : 'Tap'} again: other devices will need the new link` : 'New key'}
          </button>
        }
      />
    </>
  )
}

// ---- Notifications (the desktop's; the phone's are pushes)

export function NotificationsBody({ state, quiet, on }: { state: 'On' | 'Off' | 'Blocked by the browser'; quiet: boolean; on: { turnOn(): void; quiet(): void } }) {
  return (
    <>
      <Setting
        title={state}
        about="For this browser."
        control={
          state === 'On' ? null : (
            <button onClick={on.turnOn} disabled={state === 'Blocked by the browser'} className={PRIMARY}>
              Turn on
            </button>
          )
        }
      />
      {state === 'On' ? <Setting title="Quiet 22:00–08:00" about="Your local time." control={<Toggle on={quiet} label="Quiet 22:00–08:00" onToggle={on.quiet} />} /> : null}
    </>
  )
}

/** The phone's: Taska on the Home Screen subscribes for pushes (not on the Home Screen yet: it says so). `push`: what
 * this phone has (null: it cannot have them here). */
export function PhonePushBody({ standalone, onPhone, phoneHref = '', push = null }: { standalone: boolean; onPhone(): void; /** Use on your phone's address */ phoneHref?: string; push?: { sub: boolean; blocked: boolean; quiet: boolean; on: { turnOn(): void; turnOff(): void; quiet(): void } } | null }) {
  if (push)
    return (
      <>
        <Setting
          title={push.blocked ? 'Blocked by the phone' : push.sub ? 'On' : 'Off'}
          about="Alerts when something needs you, even with Taska closed."
          control={
            push.sub ? (
              <button onClick={push.on.turnOff} className={SECOND}>
                Turn off
              </button>
            ) : (
              <button onClick={push.on.turnOn} disabled={push.blocked} className={PRIMARY}>
                Turn on
              </button>
            )
          }
        />
        {push.sub ? <Setting title="Quiet 22:00–08:00" about="Alerts held until morning." control={<Toggle on={push.quiet} label="Quiet 22:00–08:00" onToggle={push.on.quiet} />} /> : null}
      </>
    )
  return (
    <Part
      title={standalone ? 'Notifications not supported' : 'Add Taska to the Home Screen first'}
      about={standalone ? 'Its browser has no push service.' : 'See Use on your phone, then open Taska from the Home Screen and turn notifications on.'}
    >
      {standalone ? null : (
        <a
          href={phoneHref}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return
            e.preventDefault()
            onPhone()
          }}
          className={`${SECOND} mt-3`}
        >
          <Icon n="phone" c="size-4" />
          Use on your phone
        </a>
      )}
    </Part>
  )
}

// ---- Voice spellings

export interface SpellingsEvents {
  editPrefs(): void
  toggleTidy(): void
  addWord(word: string): Promise<boolean>
  forget(c: Spelling): void
}

export function SpellingsBody({ fixes, prefs, editing, prefsSlot, on }: { fixes: Spelling[] | null; prefs: VoicePrefs | null; editing: boolean; prefsSlot?: ReactNode; on: SpellingsEvents }) {
  const [word, setWord] = useState('')
  if (!fixes) return <Loading />
  const add = () => {
    if (!word.trim()) return
    void on.addWord(word).then((ok) => ok && setWord(''))
  }
  return (
    <>
      {prefs ? (
        <>
          <Part
            title={
              <>
                Transcription preferences
                {prefs.default ? <span className="ml-2 text-[13px] font-normal text-zinc-400">default</span> : null}
              </>
            }
            about="How voice notes are transcribed across all projects."
          >
            {editing ? (
              <div className="mt-3">{prefsSlot}</div>
            ) : (
              <>
                <div className="mt-3 rounded-xl bg-zinc-100 px-3.5 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">{prefs.text || ''}</div>
                <button onClick={on.editPrefs} className={`${SECOND} mt-3`}>
                  <Icon n="pencil" c="size-4" />
                  Edit
                </button>
              </>
            )}
          </Part>
          <Setting
            title="Tidy voice notes"
            about={prefs.tidy ? 'Removes fillers and repeats, joins sentences, and keeps details. Original words remain available.' : 'Written word for word.'}
            control={
              <button onClick={on.toggleTidy} role="switch" aria-checked={!!prefs.tidy} className={SECOND}>
                {prefs.tidy ? 'Turn off' : 'Turn on'}
              </button>
            }
          />
          <Part title="Spellings" about={fixes.length ? 'Custom words and corrections for transcription.' : 'None. Add words below or correct them directly in a voice note.'}>
            <div className="mt-3 flex items-center gap-1.5">
              <input
                className={`${FIELD} h-10 py-1.5 text-sm`}
                placeholder="Name or term (e.g. Needs you)"
                aria-label="A word or name"
                autoComplete="off"
                spellCheck={false}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    add()
                  }
                }}
              />
              <button onClick={add} className="h-10 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                Add
              </button>
            </div>
          </Part>
        </>
      ) : null}
      {!fixes.length ? (
        prefs ? null : (
          <Ruled>
            <Empty>None yet. When a voice note gets words wrong, select them in the input and write the right ones: from then on every project writes them your way.</Empty>
          </Ruled>
        )
      ) : (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {fixes.map((c) => (
            <li key={(c.wrong || '') + c.right} className="flex min-h-13 items-center gap-3 py-1.5 text-[15px]">
              <span className="min-w-0 flex-1 break-words">
                {c.wrong ? (
                  <>
                    <span className="text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500">{c.wrong}</span>
                    <span className="px-2 text-zinc-400 dark:text-zinc-500">→</span>
                  </>
                ) : null}
                <span className="font-medium">{c.right}</span>
              </span>
              <button
                onClick={() => on.forget(c)}
                aria-label="Forget this spelling"
                title="Forget this spelling"
                className="grid size-11 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 lg:size-9 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Icon n="x" c="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// ---- Organizer

export function OrganizerBody({ on, model }: { on: boolean; model: string }) {
  return on ? <Part title="On" about={`Gemini (${model}) creates or updates items from inputs across all projects. See and undo its actions in Inputs.`} /> : <Part title="Off" about="Set GEMINI_API_KEY to turn it on" />
}
