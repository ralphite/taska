// Sheets about an item's talk: what the item came from (each input, with its words and files and what the organizer
// made of it), and a message's menu. Props only.

import type { ReactNode } from 'react'
import { when } from '../../model/time'
import type { FileRef, Input } from '../../model/types'
import { inputCode, whoName } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import type { SheetParts } from '../../ui/Sheet'
import { MENU_ROW } from '../../ui/tones'
import { Skeleton } from '../../ui/bits'

/** What an agent reading the item gets, word for word (F568); null while it comes. */
/** Later (D115 #21): Tomorrow, Next week, a day picked (then back to Now by itself), or no day; Back to now when it is
 * Later already. `days`: from laterDays; `until`: its day now. */
export function laterSheet(code: string, f: { later: boolean; until: string | null; days: { today: string; tomorrow: string; nextWeek: string }; say(day: string): string }, on: { pick(day: string | null): void; now(): void }): SheetParts {
  // the one it is now: the blue check on its right, as the status, priority and type menus have it
  const check = <Icon n="check" c="size-4 shrink-0 text-blue-600 dark:text-blue-400" sw="2.5" />
  const picked = f.later && !!f.until && f.until !== f.days.tomorrow && f.until !== f.days.nextWeek
  const row = (label: string, day: string | null, note = '') => (
    <button key={label} onClick={() => on.pick(day)} aria-current={f.later && f.until === day ? 'true' : undefined} className={`${MENU_ROW} h-11 aria-[current=true]:font-semibold`}>
      <Icon n="clock" c="size-4 text-zinc-500 dark:text-zinc-400" />
      <span className="flex-1">{label}</span>
      {note ? <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{note}</span> : null}
      {f.later && f.until === day ? check : null}
    </button>
  )
  return {
    menu: true,
    title: `${code} later`,
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        {f.later ? (
          <button onClick={on.now} className={`${MENU_ROW} h-11`}>
            <Icon n="up" c="size-4 text-zinc-500 dark:text-zinc-400" />
            Back to now
          </button>
        ) : null}
        {row('Tomorrow', f.days.tomorrow, f.say(f.days.tomorrow))}
        {row('Next week', f.days.nextWeek, f.say(f.days.nextWeek))}
        {/* the whole row a button: it opens the system's date picker at once (R6-3 #3); the day picked said on its right as
            the other rows say theirs. The date's own field is out of sight beside it (not inside a button). */}
        <div className="relative">
          <button
            onClick={(e) => {
              const input = e.currentTarget.nextElementSibling
              if (!(input instanceof HTMLInputElement)) return
              try {
                if ('showPicker' in input) return input.showPicker()
              } catch {
                // not allowed here: the field itself, as in a browser without showPicker
              }
              input.focus()
              input.click()
            }}
            aria-current={picked ? 'true' : undefined}
            className={`${MENU_ROW} h-11 aria-[current=true]:font-semibold`}
          >
            <Icon n="clock" c="size-4 text-zinc-500 dark:text-zinc-400" />
            <span className="flex-1">Pick a date</span>
            {picked && f.until ? <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{f.say(f.until)}</span> : null}
            {picked ? check : null}
          </button>
          <input
            type="date"
            tabIndex={-1}
            aria-label="Later until"
            min={f.days.tomorrow}
            defaultValue={picked && f.until ? f.until : ''}
            onChange={(e) => e.target.value && on.pick(e.target.value)}
            className="pointer-events-none absolute right-3 bottom-0 size-px opacity-0"
          />
        </div>
        {row('No date', null)}
      </div>
    ),
  }
}

export function agentCardSheet(code: string, text: string | null): SheetParts {
  return {
    title: `What agents see · ${code}`,
    body: text === null ? (
      <Skeleton shape="text" n={6} />
    ) : (
      <pre className="font-mono text-[12.5px] leading-5 break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{text}</pre>
    ),
  }
}

/** What an item came from: each input, with its words and files and what the organizer made of it. */
export function sourcesSheet({ code, inputs, world, now, files }: { code: string; inputs: Input[]; world: InlineWorld; now: number; files(f: FileRef[]): ReactNode }, goInput: (id: string) => void): SheetParts {
  return {
    title: `What ${code} came from`,
    body: (
      <div className="flex flex-col gap-4">
        {inputs.length ? (
          inputs.map((r) => (
            <div key={r.id}>
              <div className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                <button onClick={() => goInput(r.id)} className="font-mono text-blue-600 hover:underline dark:text-blue-400">
                  {inputCode(r.id)}
                </button>{' '}
                · {when(r.t, now)}
                {r.by === 'you' ? '' : ` · ${whoName(r.by)}`}
              </div>
              <div className="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed dark:bg-blue-400/10">
                {r.text ? <Rich text={r.text} world={world} /> : null}
                {r.files.length ? <div className="mt-2 flex items-end gap-2 overflow-x-auto lg:scrollbar-thin">{files(r.files)}</div> : null}
              </div>
              {r.org ? (
                <div className="mt-1.5 flex items-center gap-1 px-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <Icon n="sparkle" c="size-3.5" />
                  {r.org.msg}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No sources.</p>
        )}
      </div>
    ),
  }
}

/** A message's menu: Hide (it folds to one line). */
export function messageMenuSheet(onHide: () => void): SheetParts {
  return {
    menu: true,
    title: 'Message',
    body: (
      <div className="-mx-1 flex flex-col gap-0.5">
        <button onClick={onHide} className={MENU_ROW}>
          <Icon n="shrink" c="size-4 text-zinc-500 dark:text-zinc-400" />
          Hide
        </button>
      </div>
    ),
  }
}
