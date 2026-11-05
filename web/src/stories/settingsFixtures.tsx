// Settings as the page draws it: its frame (the desktop's column of sections and the section beside it; the phone's
// index or one section's page), the way through (DeskNav, PhoneIndex) and each section's own body, with what they
// show worked out by the page's own settingsFacts from a demo project (Shop: the item list's) and what the page has
// of the other projects. Used by Settings' stories.
import { useState, type ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { DeletedBody, DocsBody, LogBody, PhoneProjectsBody } from '../features/settings/PhoneSections'
import { Loading } from '../features/settings/SettingsParts'
import { boxAt } from './boxFixtures'
import { NotificationsBody, OrganizerBody, PhoneBody, PhonePushBody, ProjectsBody, SpellingsBody, type ProjectsEvents } from '../features/settings/Sections'
import { SettingsFrame } from '../features/settings/SettingsFrame'
import { DeskNav, PhoneIndex } from '../features/settings/SettingsNav'
import { deletedRows, docRows, logRows, navFacts, projectsOf } from '../features/settings/settingsFacts'
import type { SectionKey } from '../features/settings/sectionList'
import type { AgentSeen, Item, LogRow, ProjectRow, Spelling } from '../model/types'
import type { DeletedProject } from '../stores/settings'
import { T, modelOf } from './fixtures'
import { doc } from './docFixtures'
import { PROJECT } from './listFixtures'
import { acts } from './acts'

const now = Date.parse(T)
const QUIET = { from: '22:00', to: '08:00' }
const at = (min: number) => new Date(now - min * 60_000).toISOString()
export const SEEN: AgentSeen[] = [
  { name: 'claude-code', t: now - 60_000, waiting: true },
  { name: 'codex', t: now - 3 * 3600_000, waiting: false },
]
const ROWS: ProjectRow[] = [
  { name: 'home', title: 'Home', open: 13, needs: 11, pos: 0 },
  { name: 'shop', title: 'Shop', open: 0, needs: 0, pos: 1 },
  { name: 'notes', title: '\u8bfb\u4e66\u7b14\u8bb0', open: 2, needs: 1, pos: 2 },
]
const GONE: DeletedProject[] = [{ name: 'old', title: 'Old notes', t: at(60 * 24 * 4), items: 4 }]
export const LOG: LogRow[] = [
  { seq: 41, t: at(5), who: 'claude-code', what: "F001 progress 'Reproduced it: the export reads the list before the filter'", ses: 'claude-code' },
  { seq: 40, t: at(20), who: 'you', what: 'T004 status review→done' },
  { seq: 39, t: at(60), who: 'claude-code', what: 'new F003 Keep the filter in the export file name' },
]
const FIXES: Spelling[] = [{ wrong: 'tasker', right: 'Taska' }, { wrong: 'cloud code', right: 'Claude Code' }, { right: 'Storybook' }]

/** How Settings is, besides where you are in it. */
export interface SettingsHere {
  /** Projects: a new one being named, one being renamed, why it was not done, a deleted one asking */
  projects?: { pNew?: boolean; pNewText?: string; pErr?: string; renaming?: string; purging?: string[]; menu?: string }
  /** Notifications on the desktop: how the browser has them, quiet hours */
  notifications?: { state: 'On' | 'Off' | 'Blocked by the browser'; quiet: boolean; hours?: { from: string; to: string } }
  /** the phone on its Home Screen with a push service: this phone's pushes */
  push?: { sub: boolean; blocked: boolean; quiet: boolean; hours?: { from: string; to: string } }
  /** Use on your phone: New key pressed once */
  newKeyAsking?: boolean
  /** Voice spellings: none yet */
  noSpellings?: boolean
  organizerOff?: boolean
  /** each list still to load, or with nothing in it (T639) */
  projectsLoading?: boolean
  noneDeleted?: boolean
  noRemote?: boolean
  /** no public address, and Taska listens on this machine only */
  noLan?: boolean
  pushLoading?: boolean
  pushUnsupported?: boolean
  spellingsLoading?: boolean
  prefs?: { editing?: boolean; tidyOff?: boolean; isDefault?: boolean }
  noDocs?: boolean
  log?: 'loading' | 'empty' | 'asking' | 'more'
  nothingDeleted?: boolean
}

/** Shop with its history: agents, documents, what was deleted, what can be undone. */
/** the demo project with its agents; `work`: something waits for an agent; `remote`: its public address ('' none) */
export const shopWithHistory = (agents: AgentSeen[] = SEEN, o: { work?: boolean; remote?: string; items?: Item[] } = {}) =>
  modelOf(o.items ?? PROJECT, [], {
    title: 'Shop',
    agents,
    work: o.work ?? true,
    base: 'http://localhost:7340/p/shop',
    remote: o.remote ?? 'https://taska.example/k/a1b2/p/shop',
    key: 'a1b2-c3d4',
    organizer: { on: true, model: 'gemini-flash-latest', busy: null },
    undo: [{ seq: 40, n: 4, f: { status: 'done' }, was: { status: 'review' }, t: at(20) }],
    deleted: [{ kind: 'item', n: 9, code: 'B009', title: 'Export button too small on the phone', at: at(90), more: 2 }, { kind: 'doc', d: 3, title: 'Old export notes', at: at(200), on: 'F001' }],
    deletedInputs: [
      { id: 'r8', t: at(60 * 3), at: at(70), text: 'The coupons page should list the expired ones too', files: 0, scope: null, items: [{ n: 15, code: 'F015', title: 'Expired coupons on the coupons page', type: 'feature' }], kept: [] },
      { id: 'r6', t: at(60 * 26), at: at(120), text: 'the drawer jumps when it opens', files: 0, scope: null, items: [], kept: [] },
      { id: 'r5', t: at(60 * 30), at: at(150), text: '', files: 2, scope: null, items: [], kept: [] },
    ],
  }, [doc({ d: 1, n: 1, title: 'Plan: the export keeps the filter' }), doc({ d: 2, n: 3, fmt: 'html', title: 'Export options', blocks: [], whole: [], detached: [] })])

export const settingsAt = (sec: SectionKey | null, desk: boolean, h: SettingsHere = {}) => <LiveSettings sec={sec} desk={desk} h={h} />

const setActs = acts('Settings', ['create', 'saveRename', 'remove', 'restore', 'purge', 'open', 'leave', 'keys', 'copy', 'newKey', 'addWord', 'forget', 'openDoc', 'item', 'input', 'undo', 'more', 'restoreThing', 'restoreInput', 'onPhone'] as const, { keys: 'Sheets › Keyboard shortcuts', openDoc: 'Document › Reading' })

/** Settings with what the page holds for it (the route's section, stores.settings: a project being named, renamed or
 * its menu open, what asks again; the notifications' and spellings' switches): a section opens (the phone's back goes
 * to its index), New project and Rename open their fields and Esc closes them, a project's ⋯ opens its menu, Delete
 * for good, New key and Undo ask again, the switches switch, Edit opens the transcription preferences (T662). What
 * needs Taska shows in the Actions panel. */
function LiveSettings({ sec: start, desk, h }: { sec: SectionKey | null; desk: boolean; h: SettingsHere }) {
  const [sec, setSec] = useState(start)
  const [p, setP] = useState({ pNew: !!h.projects?.pNew, pNewText: h.projects?.pNewText ?? '', pErr: h.projects?.pErr ?? '', renaming: h.projects?.renaming ?? null, pMenu: h.projects?.menu ?? null })
  const [asked, setAsked] = useState<Record<string, number>>(() => ({ ...Object.fromEntries((h.projects?.purging ?? []).map((n) => [`purge ${n}`, 1])), ...(h.newKeyAsking ? { 'new-key': 1 } : {}) }))
  const [notices, setNotices] = useState<NonNullable<SettingsHere['notifications']>>(h.notifications ?? { state: 'On', quiet: false })
  const [push, setPush] = useState(h.push ?? null)
  const [editing, setEditing] = useState(!!h.prefs?.editing)
  const [tidy, setTidy] = useState(!h.prefs?.tidyOff)
  const [logAsking, setLogAsking] = useState<ReadonlySet<number> | null>(null)
  // what the column says comes from the same data as the section, as on the page
  const shop = shopWithHistory()
  const m = h.organizerOff ? { ...shop, facts: { ...shop.facts, organizer: { ...shop.facts.organizer, on: false } } } : shop
  const side = sideProjects(ROWS, m, 'shop').list
  const rows = h.projectsLoading ? null : ROWS
  const st = { deleted: h.noneDeleted ? [] : GONE, ...p }
  const ask = (key: string, run: () => void) => (asked[key] ? run() : setAsked({ ...asked, [key]: 1 }))
  // the column says what the section shows (the desktop's state; the phone's pushes on or off)
  const nav = navFacts(m, { notifications: desk ? notices.state.replace('Blocked by the browser', 'Blocked') : push?.sub ? 'On' : 'Off', projects: ROWS.length, spellings: h.spellingsLoading || h.noSpellings ? '' : FIXES.length })
  const pOn: ProjectsEvents = {
    newProject: (on) => setP({ ...p, pNew: on, pNewText: on ? p.pNewText : '', pErr: '', renaming: null, pMenu: null }),
    create: (t) => (setActs.create(t), setP({ ...p, pNew: false })),
    rename: (slug) => setP({ ...p, renaming: slug, pMenu: null }),
    saveRename: (slug, t, was) => (setActs.saveRename(slug, t, was), setP({ ...p, renaming: null })),
    remove: (slug) => (setActs.remove(slug), setP({ ...p, pMenu: null })),
    restore: setActs.restore,
    purge: (slug) => ask(`purge ${slug}`, () => setActs.purge(slug)),
    menu: (k) => setP({ ...p, pMenu: p.pMenu === k ? null : k, renaming: null }),
    open: setActs.open,
  }
  // the page's nav: a section opens; the phone's back goes to the index, the desktop's leaves Settings
  const back = () => (!desk && sec ? setSec(null) : setActs.leave())
  const navOn = { open: setSec, back, keys: setActs.keys, href: () => '#' }
  const toggles = (set: (on: boolean) => void) => ({ turnOn: () => set(true), turnOff: () => set(false) })
  const bodies: Record<SectionKey, () => ReactNode> = {
    projects: () => (desk ? <ProjectsBody f={projectsOf(rows, side, st, asked, '~/.taska/shop/shop.db')} on={pOn} /> : <PhoneProjectsBody f={projectsOf(rows, side, st, asked, '')} on={pOn} />),
    phone: () => <PhoneBody link={h.noRemote ? '' : m.facts.remote + '/'} lan={h.noRemote && !h.noLan ? 'http://192.168.1.20:7340/p/shop/' : ''} keyText={m.facts.key} asking={!!asked['new-key']} desk={desk} on={{ copy: setActs.copy, newKey: () => ask('new-key', setActs.newKey) }} />,
    notifications: () =>
      desk ? (
        <NotificationsBody state={notices.state} quiet={notices.quiet} hours={notices.hours ?? QUIET} on={{ ...toggles((on) => setNotices({ ...notices, state: on ? 'On' : 'Off' })), quiet: () => setNotices({ ...notices, quiet: !notices.quiet }), hours: (hours) => setNotices({ ...notices, hours }) }} />
      ) : h.pushLoading ? (
        <Loading />
      ) : h.pushUnsupported ? (
        <PhonePushBody standalone onPhone={setActs.onPhone} phoneHref="#" />
      ) : push ? (
        <PhonePushBody standalone onPhone={setActs.onPhone} phoneHref="#" push={{ hours: QUIET, ...push, on: { ...toggles((on) => setPush({ ...push, sub: on })), quiet: () => setPush({ ...push, quiet: !push.quiet }), hours: (hours) => setPush({ ...push, hours }) } }} />
      ) : (
        <PhonePushBody standalone={false} onPhone={setActs.onPhone} phoneHref="#" />
      ),
    spellings: () => (
      <SpellingsBody
        fixes={h.spellingsLoading ? null : h.noSpellings ? [] : FIXES}
        prefs={{ text: h.prefs?.isDefault ? 'Write it as said.' : 'Write it as said; keep code words as they are.', default: !!h.prefs?.isDefault, tidy }}
        editing={editing}
        prefsSlot={editing && desk ? boxAt({ mode: { kind: 'prefs', was: 'Write it as said; keep code words as they are.' }, text: 'Write it as said; keep code words as they are.' }, true) : undefined}
        on={{ editPrefs: () => setEditing(!editing), toggleTidy: () => setTidy(!tidy), addWord: async (w) => (setActs.addWord(w), true), forget: setActs.forget }}
      />
    ),
    organizer: () => <OrganizerBody on={!h.organizerOff} model="gemini-flash-latest" />,
    docs: () => <DocsBody docs={h.noDocs ? [] : docRows(m)} onOpen={setActs.openDoc} />,
    log: () => {
      const rows = h.log === 'loading' ? null : h.log === 'empty' ? [] : logRows(m, LOG)
      const asking = logAsking ?? new Set(h.log === 'asking' && rows?.length ? [rows.find((x) => x.undo != null)?.undo ?? -1] : [])
      return <LogBody rows={rows} end={h.log !== 'more'} asking={asking} on={{ item: setActs.item, input: setActs.input, undo: (seq) => (asking.has(seq) ? setActs.undo(seq) : setLogAsking(new Set([...asking, seq]))), more: setActs.more }} />
    },
    deleted: () => <DeletedBody {...(h.nothingDeleted ? { things: [], inputs: [] } : deletedRows(m))} on={{ restore: setActs.restoreThing, restoreInput: setActs.restoreInput }} />,
  }
  return (
    <div className="flex h-full flex-col">
      <SettingsFrame
        desk={desk}
        sec={sec}
        place=""
        nav={desk ? <DeskNav current={sec ?? 'projects'} back="New input" f={nav} on={navOn} /> : sec ? null : <PhoneIndex f={nav} on={navOn} />}
        prefs={editing && desk}
        body={bodies[sec ?? 'projects']()}
        onBack={back}
      />
    </div>
  )
}
