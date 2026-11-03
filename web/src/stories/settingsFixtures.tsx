// Settings as the page draws it: its frame (the desktop's column of sections and the section beside it; the phone's
// index or one section's page), the way through (DeskNav, PhoneIndex) and each section's own body, with what they
// show worked out by the page's own settingsFacts from a demo project (Shop: the item list's) and what the page has
// of the other projects. Used by Settings' stories.
import type { ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { DeletedBody, DocsBody, LogBody, PhoneProjectsBody } from '../features/settings/PhoneSections'
import { Loading } from '../features/settings/SettingsParts'
import { boxAt } from './boxFixtures'
import { NotificationsBody, OrganizerBody, PhoneBody, PhonePushBody, ProjectsBody, SpellingsBody } from '../features/settings/Sections'
import { SettingsFrame } from '../features/settings/SettingsFrame'
import { DeskNav, PhoneIndex } from '../features/settings/SettingsNav'
import { deletedRows, docRows, logRows, navFacts, projectsOf } from '../features/settings/settingsFacts'
import type { SectionKey } from '../features/settings/sectionList'
import type { AgentSeen, LogRow, ProjectRow, Spelling } from '../model/types'
import type { DeletedProject } from '../stores/settings'
import { T, modelOf } from './fixtures'
import { doc } from './docFixtures'
import { PROJECT } from './listFixtures'

const no = () => {}
const now = Date.parse(T)
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
  notifications?: { state: 'On' | 'Off' | 'Blocked by the browser'; quiet: boolean }
  /** the phone on its Home Screen with a push service: this phone's pushes */
  push?: { sub: boolean; blocked: boolean; quiet: boolean }
  /** Use on your phone: New key pressed once */
  newKeyAsking?: boolean
  /** Voice spellings: none yet */
  noSpellings?: boolean
  organizerOff?: boolean
  /** each list still to load, or with nothing in it (T639) */
  projectsLoading?: boolean
  noneDeleted?: boolean
  noRemote?: boolean
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
export const shopWithHistory = (agents: AgentSeen[] = SEEN, o: { work?: boolean; remote?: string } = {}) =>
  modelOf(PROJECT, [], {
    title: 'Shop',
    agents,
    work: o.work ?? true,
    base: 'http://localhost:7340/p/shop',
    remote: o.remote ?? 'https://taska.example/k/a1b2/p/shop',
    key: 'a1b2-c3d4',
    organizer: { on: true, model: 'gemini-flash-latest', busy: null },
    undo: [{ seq: 40, n: 4, f: { status: 'done' }, was: { status: 'review' }, t: at(20) }],
    deleted: [{ kind: 'item', n: 9, code: 'B009', title: 'Export button too small on the phone', at: at(90) }, { kind: 'doc', d: 3, title: 'Old export notes', at: at(200), on: 'F001' }],
    deletedInputs: [{ id: 'r6', t: at(60 * 26), at: at(120), text: 'the drawer jumps when it opens', files: 0, scope: null, items: [], kept: [] }],
  }, [doc({ d: 1, n: 1, title: 'Plan: the export keeps the filter' }), doc({ d: 2, n: 3, fmt: 'html', title: 'Export options', blocks: [], whole: [], detached: [] })])

export function settingsAt(sec: SectionKey | null, desk: boolean, h: SettingsHere = {}) {
  const m = shopWithHistory()
  const side = sideProjects(ROWS, m, 'shop').list
  const rows = h.projectsLoading ? null : ROWS
  const st = { deleted: h.noneDeleted ? [] : GONE, pNew: !!h.projects?.pNew, pNewText: h.projects?.pNewText ?? '', pErr: h.projects?.pErr ?? '', renaming: h.projects?.renaming ?? null, pMenu: h.projects?.menu ?? null }
  const asked = Object.fromEntries((h.projects?.purging ?? []).map((n) => [`purge ${n}`, 1]))
  // the column says what the section shows (the desktop's state; the phone's pushes on or off)
  const nav = navFacts(m, { notifications: desk ? (h.notifications?.state ?? 'On').replace('Blocked by the browser', 'Blocked') : h.push?.sub ? 'On' : 'Off', projects: ROWS.length, spellings: FIXES.length })
  const pOn = { newProject: no, create: no, rename: no, saveRename: no, remove: no, restore: no, purge: no, menu: no, open: no }
  const navOn = { open: no, back: no, keys: no, href: () => '#' }
  const bodies: Record<SectionKey, () => ReactNode> = {
    projects: () => (desk ? <ProjectsBody f={projectsOf(rows, side, st, asked, '~/.taska/shop/shop.db')} on={pOn} /> : <PhoneProjectsBody f={projectsOf(rows, side, st, asked, '')} on={pOn} />),
    phone: () => <PhoneBody link={h.noRemote ? '' : m.facts.remote + '/'} keyText={m.facts.key} asking={!!h.newKeyAsking} desk={desk} on={{ copy: no, newKey: no }} />,
    notifications: () =>
      desk ? (
        <NotificationsBody state={h.notifications?.state ?? 'On'} quiet={h.notifications?.quiet ?? false} on={{ turnOn: no, quiet: no }} />
      ) : h.pushLoading ? (
        <Loading />
      ) : h.pushUnsupported ? (
        <PhonePushBody standalone onPhone={no} phoneHref="#" />
      ) : h.push ? (
        <PhonePushBody standalone onPhone={no} phoneHref="#" push={{ ...h.push, on: { turnOn: no, turnOff: no, quiet: no } }} />
      ) : (
        <PhonePushBody standalone={false} onPhone={no} phoneHref="#" />
      ),
    spellings: () => (
      <SpellingsBody
        fixes={h.spellingsLoading ? null : h.noSpellings ? [] : FIXES}
        prefs={{ text: h.prefs?.isDefault ? 'Write it as said.' : 'Write it as said; keep code words as they are.', default: !!h.prefs?.isDefault, tidy: !h.prefs?.tidyOff }}
        editing={!!h.prefs?.editing}
        prefsSlot={h.prefs?.editing && desk ? boxAt({ mode: { kind: 'prefs', was: 'Write it as said; keep code words as they are.' }, text: 'Write it as said; keep code words as they are.' }, true) : undefined}
        on={{ editPrefs: no, toggleTidy: no, addWord: async () => true, forget: no }}
      />
    ),
    organizer: () => <OrganizerBody on={!h.organizerOff} model="gemini-flash-latest" />,
    docs: () => <DocsBody docs={h.noDocs ? [] : docRows(m)} onOpen={no} />,
    log: () => {
      const rows = h.log === 'loading' ? null : h.log === 'empty' ? [] : logRows(m, LOG)
      const asking = new Set(h.log === 'asking' && rows?.length ? [rows.find((x) => x.undo != null)?.undo ?? -1] : [])
      return <LogBody rows={rows} end={h.log !== 'more'} asking={asking} on={{ item: no, input: no, undo: no, more: no }} />
    },
    deleted: () => <DeletedBody {...(h.nothingDeleted ? { things: [], inputs: [] } : deletedRows(m))} on={{ restore: no, restoreInput: no }} />,
  }
  return (
    <div className="flex h-full flex-col">
      <SettingsFrame
        desk={desk}
        sec={sec}
        place=""
        nav={desk ? <DeskNav current={sec ?? 'projects'} back="New input" f={nav} on={navOn} /> : sec ? null : <PhoneIndex f={nav} on={navOn} />}
        prefs={!!h.prefs?.editing && desk}
        body={bodies[sec ?? 'projects']()}
        onBack={no}
      />
    </div>
  )
}
