// Shared rules in the rules (T779, D134). Read: a line `{{编程}}` is a dashed block "Shared rules · 编程 · 3 projects"
// that opens its text in place (its name goes to that shared rule); a name not found is red. Editing: what is not
// found, said beside the buttons; the editor's Shared button; the list Insert picks from (each shared rule, and its
// sections, those in the text ticked). A shared rule's page: the projects that put it in, each with its line. Props
// only.

import { Fragment, type MouseEvent, type ReactNode } from 'react'
import { resolve, runsOf, usedCount } from '../../model/includes'
import type { SharedRule } from '../../model/types'
import { plural } from '../../model/words'
import { CurrentMark, ProjTile } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { InlineWorld } from '../../ui/markdown/inline'
import { MENU_ROW, MUTED } from '../../ui/tones'
import { DocBlock } from './DocBlock'

/** Text of the rules drawn as the document draws its paragraphs, so a shared rule's reads as the text around it. */
export function MdText({ md, world }: { md: string; world: InlineWorld }) {
  return (
    <div className="space-y-3 text-[15px]">
      {md
        .split(/\n{2,}/)
        .filter((t) => t.trim())
        .map((t, i) => (
          <div key={i} className="py-1 break-words">
            <DocBlock b={{ kind: /^#/.test(t) ? 'heading' : /^\s*([-*+]|\d+\.)\s/.test(t) ? 'list' : /^```/.test(t) ? 'code' : 'para', text: t }} title={false} world={world} />
          </div>
        ))}
    </div>
  )
}

export interface IncludeFacts {
  /** 编程, or 编程 › 测试 */
  label: string
  /** what it puts in; null: not found */
  md: string | null
  /** how many projects put that shared rule in (null: the shared rules not here yet) */
  count: number | null
  open: boolean
}

/** A line read: "Shared rules · 编程 · 3 projects" (a click opens its text in place, its name goes to that shared rule);
 * a name not found, in red. */
export function IncludeBlock({ f, world, on }: { f: IncludeFacts; world: InlineWorld; on: { toggle(): void; open(): void } }) {
  if (f.md == null)
    return (
      <div data-include={f.label} className="flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300">
        <Icon n="alert" c="size-4 shrink-0" />
        <span className="min-w-0 break-words">Not found: {f.label}</span>
      </div>
    )
  return (
    <div data-include={f.label} className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={f.open}
        onClick={on.toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), on.toggle())}
        className={`flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 ${f.open ? 'rounded-t-lg' : 'rounded-lg'} ${MUTED}`}
      >
        <Icon n={f.open ? 'down' : 'right'} c="size-4 shrink-0" />
        <span className="min-w-0 flex-1 break-words">
          Shared rules ·{' '}
          <button onClick={(e: MouseEvent) => (e.stopPropagation(), on.open())} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {f.label}
          </button>{' '}
          {f.count == null ? null : `· ${plural(f.count, 'project')}`}
        </span>
      </div>
      {f.open ? (
        <div className="border-t border-dashed border-zinc-300 px-3 pt-2 pb-3 dark:border-zinc-700">
          <MdText md={f.md} world={world} />
        </div>
      ) : null}
    </div>
  )
}

/** A paragraph with lines that put shared rules in: each line a block (opened: its text in place), the words between
 * them as the document draws its own; null: it has none. */
export function includeRuns(text: string, shared: readonly SharedRule[] | null, world: InlineWorld, opened: ReadonlySet<string>, on: { toggle(label: string): void; open(slug: string): void }): ReactNode | null {
  const runs = runsOf(text)
  if (!runs) return null
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {runs.map((r, i) => {
        if (r.kind === 'text') return <MdText key={i} md={r.text} world={world} />
        // the shared rules not here yet: the block as found, its text when they come
        const got = shared ? resolve(r.inc, shared) : null
        return (
          <IncludeBlock
            key={i}
            f={{ label: r.inc.label, md: shared ? (got?.md ?? null) : '', count: got ? usedCount(got.rule) : null, open: opened.has(r.inc.label) }}
            world={world}
            on={{ toggle: () => on.toggle(r.inc.label), open: () => got && on.open(got.rule.slug) }}
          />
        )
      })}
    </div>
  )
}

/** While writing: the names not found, in red beside the buttons; none, the editor's own hint. */
export function NotFoundHint({ labels, hint }: { labels: readonly string[]; hint: string }) {
  if (!labels.length) return <>{hint}</>
  return (
    <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
      <Icon n="alert" c="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">Not found: {labels.join(', ')}</span>
    </span>
  )
}

/** The editor's button for the shared rules (its look is Speak's): "Insert shared rules", the phone's "Shared". */
export function SharedButton({ onClick }: { onClick(e: MouseEvent<HTMLButtonElement>): void }) {
  return (
    <button onClick={onClick} title="Insert shared rules" className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
      <Icon n="book" />
      <span className="max-lg:hidden">Insert shared rules</span>
      <span className="lg:hidden">Shared</span>
    </button>
  )
}

export interface InsertRow {
  name: string
  line: string
  count: number
  /** its sections a line can name (one alone is the whole) */
  parts: { name: string; line: string }[]
}

/** What Insert picks from: each shared rule (how many projects use it) and its sections; those in the text ticked.
 * None yet: where they are made. */
export function InsertList({ rows, has, on }: { rows: readonly InsertRow[] | null; has(line: string): boolean; on: { pick(line: string): void; settings(): void } }) {
  const row = (line: string, name: string, note: string, sub: boolean) => (
    <button key={line} onClick={() => on.pick(line)} className={`${MENU_ROW} h-11 ${sub ? 'pl-10' : ''}`}>
      {sub ? null : <Icon n="book" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />}
      <span className={`min-w-0 flex-1 truncate ${sub ? 'text-zinc-600 dark:text-zinc-300' : 'font-medium'}`}>{sub ? `› ${name}` : name}</span>
      {note ? <span className={`shrink-0 text-xs ${MUTED}`}>{note}</span> : null}
      <span className="grid size-4 shrink-0 place-items-center">{has(line) ? <CurrentMark /> : null}</span>
    </button>
  )
  if (rows && !rows.length)
    return (
      <div className="px-3 pb-2">
        <p className={`text-sm ${MUTED}`}>No shared rules yet.</p>
        <button onClick={on.settings} className="mt-2 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
          Settings › Shared rules
        </button>
      </div>
    )
  return (
    <div className="-mx-1 flex flex-col">
      {(rows ?? []).map((r) => (
        <Fragment key={r.name}>
          {row(r.line, r.name, plural(r.count, 'project'), false)}
          {r.parts.length > 1 ? r.parts.map((p) => row(p.line, p.name, '', true)) : null}
        </Fragment>
      ))}
    </div>
  )
}

export interface UsedRow {
  project: string
  title: string
  line: string
  tone: string
  icon?: string
}

/** A shared rule's page, under its text: each project that puts it in, and its line, read only; a row goes to that
 * project's Rules. */
export function UsedBy({ rows, on }: { rows: readonly UsedRow[]; on: { open(project: string): void } }) {
  return (
    <section data-part="used-by" className="mt-8 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <h2 className="text-[15px] font-semibold">Used by</h2>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((u) => (
            <li key={u.project + u.line}>
              <button onClick={() => on.open(u.project)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:opacity-80">
                <ProjTile title={u.title} tone={u.tone} icon={u.icon} cls="size-8 rounded-lg text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{u.title}</span>
                  <span className={`mt-0.5 block truncate font-mono text-xs ${MUTED}`}>{u.line}</span>
                </span>
                <span className={`shrink-0 text-[13px] ${MUTED}`}>Rules</span>
                <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-1 text-sm leading-relaxed ${MUTED}`}>No project uses it yet.</p>
      )}
    </section>
  )
}
