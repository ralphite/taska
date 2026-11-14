// I779 prototype: shared rule groups. Rules written once at the workspace's level, in groups (All projects, Coding,
// Writing), each its Markdown and the projects that include it; a project's Rules tab reads the groups it includes,
// each marked, then its own rules. What is drawn here is only what is new: the groups' list and a group opened in
// Settings, the Includes line, the groups' labels and the pick list of the Rules tab. Everything around them is the
// page's own (SettingsFrame, DeskNav, PhoneIndex, Part, Toggle, RulesReading, DocView, DocEdit, Sheet, BarBtn) with
// the demo data of their own stories. Nothing here changes Taska.
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { sideProjects } from '../../app/sideProjects'
import { DocEdit } from '../../features/docs/DocEdit'
import { PHONE_DOC_LOOK } from '../../features/docs/DocView'
import { BarBtn, RULES_COLUMN } from '../../features/docs/Rules'
import type { SectionKey } from '../../features/settings/sectionList'
import { Part, Toggle } from '../../features/settings/SettingsParts'
import { plural } from '../../model/words'
import { ago } from '../../model/time'
import type { Doc, RuleVersion } from '../../model/types'
import { CurrentMark, ProjTile } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { CHIP, LINK_BTN, MUTED, SECOND } from '../../ui/tones'
import { acts } from '../acts'
import { docAt } from '../docPage'
import { T } from '../fixtures'
import { inFrame } from '../Frames'
import { HISTORY, at, rulesDocOf } from '../rulesFixtures'
import { ROWS, shopWithHistory, type SettingsHere } from '../settingsFixtures'

const NOW = Date.parse(T) + 60_000

// ---------------------------------------------------------------- the groups, and Shop's own rules

/** The rules document's text (rulesFixtures' v7), split: what every project keeps goes to All projects, what every
 * coding project keeps to Coding; how Shop's agents work stays Shop's. */
const text = (...parts: string[][]) => parts.map((p) => p.join('\n')).join('\n\n')
const ALL_MD = text(
  ['## Communication', '', '- Write to Yadong in Taska only; one line, a document for more.', '- Ask before work that changes the scope.'],
  ['## Waiting', '', "- Never poll: wait on Taska's next, which answers when there is work."],
)
const CODING_MD = text(
  ['## Commits', '', '- Commit messages are in English, in the imperative ("Add", "Fix").', '- Run the unit tests before each commit.', '- One step per commit; add only the paths you changed.'],
  ['## Shipping', '', "- Ship only with the project's ship script; it runs the checks first.", '- Never push without asking.'],
  ['## Code style', '', '- Never add a dependency without asking.', "- Follow the code around you; don't reformat what you don't change."],
)
const WRITING_MD = text(['## Notes', '', '- A quote keeps its page number.', "- Write a book's notes in the book's language."])
const SHOP_MD = text(['## How agents work', '', '- Read this document once per session.', '- Small changes: the main agent makes them; big ones go to their own worktree.'])

export interface Group {
  key: string
  name: string
  md: string
  /** the projects that include it, by their address */
  projects: string[]
  by: string
  /** minutes since it last changed */
  ago: number
  d: number
}
export const GROUPS: Group[] = [
  { key: 'all', name: 'All projects', md: ALL_MD, projects: ['home', 'shop', 'notes'], by: 'you', ago: 60 * 50, d: 11 },
  { key: 'coding', name: 'Coding', md: CODING_MD, projects: ['home', 'shop'], by: 'you', ago: 60 * 26, d: 12 },
  { key: 'writing', name: 'Writing', md: WRITING_MD, projects: ['notes'], by: 'you', ago: 60 * 24 * 9, d: 13 },
]
const groupOf = (k: string) => GROUPS.find((g) => g.key === k) as Group

/** A group's text as the page has a rules document (its blocks), so the page's DocView reads it. */
const groupDoc = (g: Group, md = g.md): Doc => {
  const v: RuleVersion = { v: 3, by: g.by, t0: at(g.ago + 4), t: at(g.ago), md, whys: [], srcs: [], seq: 1 }
  return { ...rulesDocOf([v], []), d: g.d, title: g.name }
}
/** Shop's own rules: its rules document as today (v7, You), less what went to the groups. */
export const SHOP_HISTORY: RuleVersion[] = [...HISTORY.slice(0, -1), { ...(HISTORY.at(-1) as RuleVersion), md: SHOP_MD }]
const shopDoc = () => rulesDocOf(SHOP_HISTORY, [])

/** The projects as Settings' Projects lists them (their tiles' colours and pictures). */
const projects = () => sideProjects(ROWS, shopWithHistory(), 'shop').list ?? []
const changed = (g: Group) => `changed ${ago(at(g.ago), NOW, 'ago')}`
const sharedBy = (n: number) => plural(n, 'project')

// ---------------------------------------------------------------- Settings › Shared rules

export const SHARED = 'shared' as SectionKey
const setActs = acts('Shared rules', ['newGroup', 'save', 'discard', 'mic'] as const)

/** Settings with Shared rules last in its column, after Organizer; `open`: a group opened. */
export const withShared = (open: string | null = null): SettingsHere => ({
  more: {
    key: SHARED,
    section: { path: 'shared', icon: 'book', name: 'Shared rules', about: () => 'Rules for several projects, written once.' },
    right: GROUPS.length,
    body: (desk) => <SharedRulesBody desk={desk} start={open} />,
  },
})

/** The groups' rows: each its name, how many projects include it and when it last changed; New group first. */
function GroupRows({ desk, inc, onOpen }: { desk: boolean; inc: Record<string, string[]>; onOpen(k: string): void }) {
  return (
    <>
      {desk ? (
        <section className="flex items-center gap-4 border-t border-zinc-200 py-5 dark:border-zinc-800">
          <button onClick={setActs.newGroup} className={`${SECOND} shrink-0`}>
            <Icon n="plus" c="size-4" sw="2" />
            New group
          </button>
        </section>
      ) : (
        <button onClick={setActs.newGroup} className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400">
          <Icon n="plus" c="size-5" />
          New group
        </button>
      )}
      <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {GROUPS.map((g) => (
          <li key={g.key}>
            <button onClick={() => onOpen(g.key)} className={`flex w-full items-center gap-3 text-left ${desk ? 'min-h-16 py-3 hover:opacity-80' : 'px-1 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
              <Icon n="book" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold break-words">{g.name}</span>
                <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>
                  {sharedBy(inc[g.key].length)} · {changed(g)}
                </span>
              </span>
              <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** A group opened: its text as the Rules tab reads a document (Edit: the page's editor), and the projects, each with
 * its switch. */
function GroupPage({ g, desk, inc, editing, on }: { g: Group; desk: boolean; inc: string[]; editing: { text: string } | null; on: { toggle(slug: string): void; edit(): void; change(t: string): void; done(): void } }) {
  const doc = editing ? (
    <DocEdit isNew={false} text={editing.text} hint={desk ? 'Esc keeps draft' : ''} mic={{ on: false, text: 'Speak' }} on={{ change: on.change, discard: () => (setActs.discard(), on.done()), save: () => (setActs.save(), on.done()), mic: setActs.mic }} />
  ) : (
    docAt(groupDoc(g), desk, { viewOnly: true })
  )
  return (
    <>
      {/* the desktop's document column is the Rules tab's: as wide as the section, its comments' room beside it */}
      <div className={`mb-6 ${desk && !editing ? '-mx-10' : ''}`}>{doc}</div>
      <Part title="Projects" about={g.key === 'all' ? 'Every new project includes it.' : "Their agents read it before each project's own rules."}>
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {projects().map((p) => (
            <li key={p.slug} className="flex min-h-14 items-center gap-3 py-2">
              <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="size-8 rounded-lg text-sm" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.title}</span>
              <Toggle on={inc.includes(p.slug)} label={`${p.title} includes ${g.name}`} onToggle={() => on.toggle(p.slug)} />
            </li>
          ))}
        </ul>
      </Part>
    </>
  )
}

/** Settings' Shared rules, as the page would hold it: a group opens (the desktop: in the section; the phone: over it,
 * as a document opens), its projects switch, Edit opens the editor. */
function SharedRulesBody({ desk, start }: { desk: boolean; start: string | null }) {
  const [open, setOpen] = useState(start)
  const [inc, setInc] = useState<Record<string, string[]>>(() => Object.fromEntries(GROUPS.map((g) => [g.key, g.projects])))
  const [editing, setEditing] = useState<{ text: string } | null>(null)
  const g = open ? groupOf(open) : null
  const close = () => (setOpen(null), setEditing(null))
  const page = g ? (
    <GroupPage
      g={g}
      desk={desk}
      inc={inc[g.key]}
      editing={editing}
      on={{
        toggle: (slug) => setInc({ ...inc, [g.key]: inc[g.key].includes(slug) ? inc[g.key].filter((x) => x !== slug) : [...inc[g.key], slug] }),
        edit: () => setEditing({ text: g.md }),
        change: (text) => setEditing({ text }),
        done: () => setEditing(null),
      }}
    />
  ) : null
  const meta = g ? `${sharedBy(inc[g.key].length)} · ${changed(g)}` : ''
  const edit = g && !editing ? <BarBtn icon="pencil" label="Edit" onClick={() => setEditing({ text: g.md })} /> : null
  if (desk)
    return g ? (
      <>
        <div className="flex items-center gap-2 border-t border-zinc-200 py-4 dark:border-zinc-800">
          <button onClick={close} aria-label="Back to the groups" title="Back to the groups · Esc" className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <Icon n="left" c="size-5" sw="2.25" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold">{g.name}</h2>
            <p className={`truncate text-xs ${MUTED}`}>{meta}</p>
          </div>
          {edit}
        </div>
        {page}
      </>
    ) : (
      <GroupRows desk inc={inc} onOpen={setOpen} />
    )
  return (
    <>
      {/* first: the rows are the card's last, its foot without a rule */}
      <Sheet open={!!g} look={PHONE_DOC_LOOK} desk={false} onClose={close}>
        {g ? <SheetLayout title={g.name} extra={edit} sub={<p className={`px-5 pb-1 text-xs ${MUTED}`}>{meta}</p>} body={page} /> : null}
      </Sheet>
      <GroupRows desk={false} inc={inc} onOpen={setOpen} />
    </>
  )
}

// ---------------------------------------------------------------- the Rules tab: what it includes, then its own

const rulesActs = acts('Rules', ['editGroup'] as const, { editGroup: 'Prototype › I779 › Settings: a group opened' })

/** A label over a group's sections, quiet: its name, how many projects share it, Edit (in Settings). Over the
 * project's own sections: its name alone (the bar's Edit edits them). */
function GroupLabel({ name, note, onEdit, id }: { name: string; note: string; onEdit?(): void; id?: string }) {
  return (
    <div data-group={id} className={`${RULES_COLUMN} mt-8 flex min-h-8 scroll-mt-4 items-center gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800 ${MUTED}`}>
      <Icon n="book" c="size-3.5 shrink-0" />
      <span className="font-semibold">{name}</span>
      <span className="min-w-0 flex-1 truncate">· {note}</span>
      {onEdit ? (
        <button onClick={onEdit} title="Edit in Settings › Shared rules" className={LINK_BTN}>
          Edit
        </button>
      ) : null}
    </div>
  )
}

/** The Rules tab's document: the line of what it includes (a group's chip goes to its sections; Change picks them),
 * each group's sections under its label, then the project's own as today. */
export function SharedReading({ desk, changing = false }: { desk: boolean; changing?: boolean }) {
  const [inc, setInc] = useState(['all', 'coding'])
  const [picking, setPicking] = useState(changing)
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null)
  const change = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    // the desktop's pick list opens under Change, as the page's menus open under their button
    const b = change.current
    if (!picking || !desk || spot || !b) return
    const r = inFrame(b.getBoundingClientRect(), b)
    setSpot({ x: r.left, y: r.bottom + 4 })
  }, [picking, desk, spot])
  const shown = GROUPS.filter((g) => inc.includes(g.key))
  const pick = (k: string) => setInc(inc.includes(k) ? inc.filter((x) => x !== k) : GROUPS.map((g) => g.key).filter((x) => x === k || inc.includes(x)))
  const rows = (
    <div className="-mx-1 flex flex-col">
      {GROUPS.map((g) => (
        <button key={g.key} onClick={() => pick(g.key)} aria-pressed={inc.includes(g.key)} className="flex h-12 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] hover:bg-zinc-100 lg:h-9 lg:text-sm dark:hover:bg-zinc-800">
          <span className="min-w-0 flex-1 truncate">{g.name}</span>
          <span className={`shrink-0 text-xs ${MUTED}`}>{sharedBy(g.projects.length)}</span>
          <span className="grid size-4 shrink-0 place-items-center">{inc.includes(g.key) ? <CurrentMark /> : null}</span>
        </button>
      ))}
    </div>
  )
  const to = (k: string) => root.current?.querySelector(`[data-group="${k}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return (
    <div ref={root} className="contents">
      <div className={`${RULES_COLUMN} flex flex-wrap items-center gap-1.5`}>
        <span className={`mr-1 text-[13px] ${MUTED}`}>Includes</span>
        {shown.map((g) => (
          <button key={g.key} onClick={() => to(g.key)} className={CHIP}>
            {g.name}
          </button>
        ))}
        <button ref={change} onClick={() => (setSpot(null), setPicking(true))} className={LINK_BTN}>
          Change
        </button>
      </div>
      {shown.map((g) => (
        <Fragment key={g.key}>
          <GroupLabel id={g.key} name={g.name} note={`shared by ${sharedBy(g.projects.length)}`} onEdit={rulesActs.editGroup} />
          {docAt(groupDoc(g), desk, { viewOnly: true })}
        </Fragment>
      ))}
      <GroupLabel name="Shop" note="this project only" />
      {docAt(shopDoc(), desk, { viewOnly: true })}
      <Sheet open={picking && (!desk || !!spot)} look={desk ? { pop: true, narrow: true, at: spot } : {}} desk={desk} onClose={() => setPicking(false)}>
        <SheetLayout menu title="Includes" body={rows} />
      </Sheet>
    </div>
  )
}
