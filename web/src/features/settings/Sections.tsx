// What each section of Settings shows: Projects (new, rename, delete, the deleted ones restored or deleted for good),
// Use on your phone (the link and the key), Notifications, Voice spellings and the transcription preferences, the
// Organizer. Props only.

import { useState, type ReactNode } from 'react'
import type { Spelling, VoicePrefs } from '../../model/types'
import { plural } from '../../model/words'
import { Kbd, ProjTile, Skeleton } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { DISABLED, FIELD, MUTED, P_BTN, PRIMARY, SECOND } from '../../ui/tones'
import { CopyBtn, Loading, Part, PH_GROUP, PhLabel, QuietHoursSetting, Setting, TextBox, Toggle } from './SettingsParts'

// ---- Projects

export interface ProjectRowFacts {
  name: string
  title: string
  tone: string
  icon?: string
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
  pErr: string
  renaming: string | null
  /** the deleted projects whose Delete forever waits for its second click */
  purging: ReadonlySet<string>
  /** the phone's row whose actions are open */
  menu: string | null
}

export interface ProjectsEvents {
  /** New project, from its button: a popover there on the desktop, a sheet on the phone (D115 #7) */
  newProject(from: HTMLElement): void
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

/** A row's buttons on the desktop: under the pointer or the keys, as a list's rows (always there on the phone). */
const ROW_ACT = 'lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100'

/** A project's name, and whether it is the one open. */
function ProjectName({ p }: { p: ProjectRowFacts }) {
  return (
    <>
      <span className="truncate">{p.title}</span>
      {p.here ? <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">This project</span> : null}
    </>
  )
}

/** A project to open (⌘ or Ctrl: in a new tab). */
function ProjectLink({ p, on, cls, children }: { p: ProjectRowFacts; on: ProjectsEvents; cls: string; children: ReactNode }) {
  return (
    <a
      href={`/p/${encodeURIComponent(p.name)}/`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return
        e.preventDefault()
        on.open(p.name)
      }}
      className={cls}
    >
      {children}
    </a>
  )
}

/** A project's new name being typed: Enter saves and Esc cancels; the phone, with no keys, has Save and Cancel. */
function Renaming({ p, desk, on }: { p: ProjectRowFacts; desk: boolean; on: ProjectsEvents }) {
  const [typed, setTyped] = useState('')
  const field = (cls: string) => <NameField value={p.title} label={`New name for ${p.title}`} cls={cls} select onValue={setTyped} onEnter={(v) => on.saveRename(p.name, v, p.title)} onEsc={() => on.rename(null)} />
  if (desk)
    return (
      <>
        {field('h-10 max-w-[22rem] py-1.5 text-[15px] font-medium')}
        <p className="mt-1.5 flex items-center gap-1 px-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Kbd k="↵" />
          <span>save ·</span>
          <Kbd k="Esc" />
          <span>
            cancel · the address stays <code className="font-mono">/p/{p.name}</code>
          </span>
        </p>
      </>
    )
  return (
    <>
      {field('h-11 py-2 font-medium')}
      <div className="mt-2 flex gap-2">
        <button onClick={() => on.saveRename(p.name, typed || p.title, p.title)} className="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          Save
        </button>
        <button onClick={() => on.rename(null)} className="h-11 shrink-0 rounded-xl px-4 text-[15px] font-medium text-zinc-600 dark:text-zinc-300">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        The address stays <span className="font-mono">/p/{p.name}</span>
      </p>
    </>
  )
}

/** A row's ⋯ on the phone: its actions in a sheet. */
function PhoneMore({ k, title, on }: { k: string; title: string; on: ProjectsEvents }) {
  return (
    <button onClick={() => on.menu(k)} aria-label={`More for ${title}`} className={`grid size-11 shrink-0 place-items-center rounded-full data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-800 ${MUTED}`}>
      <Icon n="more" c="size-5" />
    </button>
  )
}

/** Projects: new, renamed, deleted, the deleted ones restored or deleted for good. One body for both layouts, each
 * in its own look: the desktop's a list whose rows show Rename and Delete under the pointer; the phone's grouped rows,
 * each row's actions under its ⋯. */
export function ProjectsBody({ f, on, desk }: { f: ProjectsFacts; on: ProjectsEvents; desk: boolean }) {
  if (!f.live) return desk ? <Loading /> : <Skeleton shape="tile" cls="px-2 py-3" />
  const deleted = (d: GoneProject) => `Deleted ${d.when} · ${plural(d.items, 'item')}`
  if (!desk)
    return (
      <>
        <div className={`${PH_GROUP} mt-4`}>
          <button onClick={(e) => on.newProject(e.currentTarget)} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400">
            <Icon n="plus" c="size-5" />
            New project
          </button>
        </div>
        <PhLabel>Projects</PhLabel>
        <div className={PH_GROUP}>
          {f.live.map((p) =>
            f.renaming === p.name ? (
              <div key={p.name} className="flex items-start gap-3 px-3.5 py-3">
                <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="mt-1.5 size-8 rounded-lg text-sm" />
                <div className="min-w-0 flex-1">
                  <Renaming p={p} desk={false} on={on} />
                </div>
              </div>
            ) : (
              <div key={p.name}>
                <div className="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5">
                  <ProjectLink p={p} on={on} cls="flex min-w-0 flex-1 items-center gap-3">
                    <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="size-8 rounded-lg text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
                        <ProjectName p={p} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono">/p/{p.name}</span> · {p.open} open
                      </span>
                    </span>
                  </ProjectLink>
                  <PhoneMore k={p.name} title={p.title} on={on} />
                </div>
              </div>
            ),
          )}
        </div>
        {f.gone.length ? (
          <>
            <PhLabel>Deleted</PhLabel>
            <div className={PH_GROUP}>
              {f.gone.map((d) => (
                <div key={d.name}>
                  <div className="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5">
                    {goneTile(d.title)}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium break-words text-zinc-500 dark:text-zinc-400">{d.title}</span>
                      <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{deleted(d)}</span>
                    </span>
                    <button onClick={() => on.restore(d.name)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                      <Icon n="undo" c="size-4" sw="2" />
                      Restore
                    </button>
                    <PhoneMore k={'gone:' + d.name} title={d.title} on={on} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </>
    )
  return (
    <>
      <section className="flex items-center gap-4 border-t border-zinc-200 py-5 dark:border-zinc-800">
        <button onClick={(e) => on.newProject(e.currentTarget)} className={`${SECOND} shrink-0`}>
          <Icon n="plus" c="size-4" sw="2" />
          New project
        </button>
      </section>
      <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {f.live.map((p) => {
          const ren = f.renaming === p.name
          return (
            <li key={p.name} className="group relative flex min-h-16 items-center gap-3 py-3">
              <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="size-8 rounded-lg text-sm" />
              <div className="min-w-0 flex-1">
                {ren ? (
                  <Renaming p={p} desk on={on} />
                ) : (
                  <ProjectLink p={p} on={on} cls="block rounded-lg hover:opacity-80">
                    <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
                      <ProjectName p={p} />
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      /p/{p.name} · {p.open} open{p.here && f.file ? ` · ${f.file}` : ''}
                    </p>
                  </ProjectLink>
                )}
              </div>
              {ren ? null : (
                // on the desktop they float at the row's end under the pointer (or the keys), taking no room from the name;
                // narrow, they keep their icons and say their words under the pointer
                <span className={`flex shrink-0 items-center ${ROW_ACT} lg:absolute lg:inset-y-0 lg:right-0 lg:bg-white lg:pl-2 dark:lg:bg-zinc-950`}>
                  <button onClick={() => on.rename(p.name)} title="Rename" aria-label="Rename" className={P_BTN}>
                    <Icon n="pencil" c="size-4" />
                    <span className="hidden @md/set:inline">Rename</span>
                  </button>
                  <button onClick={() => on.remove(p.name)} title="Delete" aria-label="Delete" className={P_BTN}>
                    <Icon n="trash" c="size-4" />
                    <span className="hidden @md/set:inline">Delete</span>
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {f.gone.length ? (
        <section className="pt-8">
          <h2 className="text-[15px] font-semibold">Deleted projects</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">Hidden; agents get no work from it. Restore brings it back intact.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {f.gone.map((d) => (
              <li key={d.name} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900">
                {goneTile(d.title)}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium break-words text-zinc-600 dark:text-zinc-300">{d.title}</p>
                  <p className="text-xs break-words text-zinc-500 dark:text-zinc-400">
                    {deleted(d)} · <span className="font-mono">/p/{d.name}</span>
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
        </section>
      ) : null}
    </>
  )
}

// ---- Use on your phone

/** `link`: the public link (with the key); `lan`: the address on this network, where a phone needs no key. Without a
 * public link the key is of no use to a phone: it is not offered. */
export function PhoneBody({ link, lan, keyText, asking, desk, on }: { link: string; lan: string; keyText: string; asking: boolean; desk: boolean; on: { copy(t: string): void; newKey(): void } }) {
  const flag = (f: string) => <code className="font-mono whitespace-nowrap">{f}</code>
  return (
    <>
      {link ? (
        <Part title="Link" about="Open on your phone">
          <TextBox t={link} />
          <CopyBtn label="Copy link" onCopy={() => on.copy(link)} />
        </Part>
      ) : lan ? (
        <Part title="Link" about={<>On this network, no key needed. From anywhere: start Taska with {flag('--public')}.</>}>
          <TextBox t={lan} />
          <CopyBtn label="Copy link" onCopy={() => on.copy(lan)} />
        </Part>
      ) : (
        <Part title="Link" about={<>Taska listens on this computer only. Start it with {flag('--host 0.0.0.0')} for your network, or {flag('--public')} for anywhere.</>} />
      )}
      <Part title="On the Home Screen" about="iPhone: Share › Add to Home Screen. Android: Menu › Install app. Taska then runs full screen and can record voice notes." />
      {/* the key, wherever another machine can reach Taska: from outside this network it asks for it once (a new key
          made on the local network showed nothing, r1228) */}
      {link || lan ? (
        <Part title="Key" about={link ? 'Or enter this key once on the device.' : 'From outside this network, enter it once on the device.'}>
          <div className="mt-3 flex items-center gap-4">
            <span className="font-mono text-2xl tracking-wider select-all">{keyText}</span>
            <button onClick={() => on.copy(keyText)} className={SECOND}>
              <Icon n="copy" c="size-4" />
              Copy key
            </button>
          </div>
        </Part>
      ) : null}
      {link || lan ? (
      <Setting
        title="New key"
        about={asking ? 'A new key signs out all other devices: each needs the new link or key.' : 'A new key signs out all other devices.'}
        control={
          <button
            onClick={on.newKey}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-400/10"
          >
            {asking ? `${desk ? 'Click' : 'Tap'} again to confirm` : 'New key'}
          </button>
        }
      />
      ) : null}
    </>
  )
}

// ---- Notifications (the desktop's; the phone's are pushes)

/** The app's icon count (D115 #19): on unless turned off. */
export interface BadgeSwitch {
  on: boolean
  toggle(): void
}

/** `blocked`: notifications not allowed, so the count cannot show either: the switch greyed, off, not to be pressed */
function BadgeSetting({ badge, blocked = false }: { badge: BadgeSwitch; blocked?: boolean }) {
  return (
    <Setting
      title="Count on the app icon"
      about={blocked ? 'Needs notifications allowed.' : 'What needs you, in every project.'}
      control={<Toggle on={badge.on && !blocked} disabled={blocked} label="Count on the app icon" onToggle={badge.toggle} />}
    />
  )
}

/** On: Turn off is Taska's own (a page cannot take back the browser's permission), as the phone's. Blocked: the page
 * cannot ask again, so no button, only where to allow them. */
export function NotificationsBody({ state, quiet, hours, badge = null, on }: { state: 'On' | 'Off' | 'Blocked by the browser'; quiet: boolean; hours: { from: string; to: string }; /** the app's icon count (null: the browser cannot) */ badge?: BadgeSwitch | null; on: { turnOn(): void; turnOff(): void; quiet(): void; hours(h: { from: string; to: string }): void } }) {
  return (
    <>
      <Setting
        title={state}
        about={state === 'Blocked by the browser' ? "Allow notifications in the browser's site settings." : 'For this browser.'}
        control={
          state === 'On' ? (
            <button onClick={on.turnOff} className={SECOND}>
              Turn off
            </button>
          ) : state === 'Off' ? (
            <button onClick={on.turnOn} className={PRIMARY}>
              Turn on
            </button>
          ) : null
        }
      />
      {state === 'On' ? <QuietHoursSetting on={quiet} hours={hours} events={{ toggle: on.quiet, hours: on.hours }} /> : null}
      {badge ? <BadgeSetting badge={badge} blocked={state === 'Blocked by the browser'} /> : null}
    </>
  )
}

/** The phone's: Taska on the Home Screen subscribes for pushes (not on the Home Screen yet: it says so). `push`: what
 * this phone has (null: it cannot have them here). */
export function PhonePushBody({ standalone, onPhone, phoneHref = '', push = null }: { standalone: boolean; onPhone(): void; /** Use on your phone's address */ phoneHref?: string; push?: { sub: boolean; blocked: boolean; quiet: boolean; hours: { from: string; to: string }; badge?: BadgeSwitch | null; on: { turnOn(): void; turnOff(): void; quiet(): void; hours(h: { from: string; to: string }): void } } | null }) {
  if (push)
    return (
      <>
        <Setting
          title={push.blocked ? 'Blocked by the phone' : push.sub ? 'On' : 'Off'}
          about={push.blocked ? "Allow notifications for Taska in the phone's Settings." : 'Even with Taska closed.'}
          control={
            push.sub ? (
              <button onClick={push.on.turnOff} className={SECOND}>
                Turn off
              </button>
            ) : push.blocked ? null : (
              <button onClick={push.on.turnOn} className={PRIMARY}>
                Turn on
              </button>
            )
          }
        />
        {push.sub ? <QuietHoursSetting on={push.quiet} hours={push.hours} events={{ toggle: push.on.quiet, hours: push.on.hours }} /> : null}
        {push.badge ? <BadgeSetting badge={push.badge} blocked={push.blocked} /> : null}
      </>
    )
  return (
    <Part
      title={standalone ? 'Notifications not supported' : 'Add Taska to the Home Screen first'}
      about={standalone ? "This browser can't show notifications." : 'Then open Taska from the Home Screen and turn them on.'}
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
  // the spellings and the preferences come together
  if (!fixes || !prefs) return <Loading />
  const add = () => {
    if (!word.trim()) return
    void on.addWord(word).then((ok) => ok && setWord(''))
  }
  return (
    <>
      <Part
        title={
          <>
            Transcription preferences
            {prefs.default ? <span className={`ml-2 text-[13px] font-normal ${MUTED}`}>default</span> : null}
          </>
        }
        about="All projects"
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
        about={prefs.tidy ? 'Drops fillers and repeats; original words kept' : 'Written word for word.'}
        control={
          <button onClick={on.toggleTidy} role="switch" aria-checked={!!prefs.tidy} className={SECOND}>
            {prefs.tidy ? 'Turn off' : 'Turn on'}
          </button>
        }
      />
      <Part title="Spellings" about={fixes.length ? undefined : 'None yet. Select wrong words in a voice note to fix them.'}>
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
          <button onClick={add} disabled={!word.trim()} className={`h-10 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 ${DISABLED}`}>
            Add
          </button>
        </div>
      </Part>
      {fixes.length ? (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {fixes.map((c) => (
            <li key={(c.wrong || '') + c.right} className="group flex min-h-13 items-center gap-3 py-1.5 text-[15px]">
              <span className="min-w-0 flex-1 break-words">
                {c.wrong ? (
                  <>
                    <span className={`line-through decoration-zinc-400 ${MUTED}`}>{c.wrong}</span>
                    <span className={`px-2 ${MUTED}`}>→</span>
                  </>
                ) : null}
                <span className="font-medium">{c.right}</span>
              </span>
              <button
                onClick={() => on.forget(c)}
                aria-label="Forget this spelling"
                title="Forget this spelling"
                className={`grid size-11 shrink-0 place-items-center rounded-lg hover:bg-zinc-100 hover:text-zinc-700 lg:size-9 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${ROW_ACT} ${MUTED}`}
              >
                <Icon n="x" c="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

// ---- Organizer

export function OrganizerBody({ on, model }: { on: boolean; model: string }) {
  return on ? <Part title="On" about={`Gemini (${model}) files inputs into items in all projects; undo it on the input`} /> : <Part title="Off" about="Set GEMINI_API_KEY to turn it on" />
}
