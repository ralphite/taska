// What Settings loads and changes: the agent guide, the change log, the projects (F173, F253), the voice spellings
// and transcription preferences (F144, F183, T256).
import { D, DR, U, bump, ctx, els, model, projOrder, render, titleOf, projTitle } from './state'
import type { ProjectRow } from './types'
import { JSON_POST, NET, keepProjects, load, net, notLoaded, notSaved, pushUndo } from './data'
import { toast } from './toast'
import { saveDraft } from './drafts'
import { navigate } from './switch'

export const P_CACHE = {
  guide: null as string | null,
  log: null as string[] | null,
  logRev: -1,
  logEnd: false, // T427: the first change is loaded: nothing earlier to ask for
  logMore: false, // earlier changes on their way
  fixes: null as null | { wrong?: string; right: string; t?: string }[],
  prefs: null as null | { text: string; default: boolean; tidy?: boolean },
  projects: null as ProjectRow[] | null,
  trash: null as null | { name: string; title: string; t: string; items: number }[],
}
export function loadGuide() {
  if (P_CACHE.guide) return
  net<string>(ctx.P + 'agent?ui=1', {}, NET.get, 'text').then(
    (g) => {
      P_CACHE.guide = g
      bump('project')
    },
    () => {},
  )
}
export async function loadFixes(once = false) {
  if (once && P_CACHE.fixes) return
  try {
    ;[P_CACHE.fixes, P_CACHE.prefs] = (await Promise.all(
      ['/api/corrections', '/api/voiceprefs'].map((u) => net(u)),
    )) as [typeof P_CACHE.fixes, typeof P_CACHE.prefs]
  } catch {
    notLoaded('the voice spellings', loadFixes)
  }
  bump('project', 'detail', 'inputs')
}
// T427: the log loads what fits a screen or two; scrolling to its end loads the changes before (LogMore)
const LOG_FIRST = 60,
  LOG_MORE = 100
type LogRow = { seq: number; t: string; who: string; what: string; ses?: string }
// T458: the agent's session rides on its name as who|session (spaces as _), one word for the line's pattern
const logText = (e: LogRow) =>
  `#${e.seq} ${e.t.slice(5, 10)} ${e.t.slice(11, 16)} ${e.who}${e.ses ? '|' + e.ses.replace(/\s/g, '_') : ''} ${e.what}`
const seqOf = (l: string) => Number(/^#(\d+)/.exec(l)?.[1] || 0)
export function loadLog() {
  // the log as it is now: when it opens, and after each change to the project. What is new goes on top; what was
  // loaded below it stays.
  P_CACHE.logRev = model.S.rev
  const p = ctx.P
  net<LogRow[]>(p + `api/log?n=${LOG_FIRST}`, {}, NET.get).then(
    (l) => {
      if (p !== ctx.P) return
      const lines = l.map(logText),
        had = P_CACHE.log,
        top = had?.length ? seqOf(had[0]) : 0,
        fresh = lines.filter((x) => seqOf(x) > top)
      if (had?.length && fresh.length < lines.length) P_CACHE.log = [...fresh, ...had]
      else {
        P_CACHE.log = lines // the first time, or more came than this holds: from the top again
        P_CACHE.logEnd = l.length < LOG_FIRST
      }
      bump('project')
    },
    () => {
      // D82 #6: on the desktop the log is a side list beside the items, not a page: it says so there too
      if (D.page || U.side === 'log') notLoaded('the change log', loadLog)
    },
  )
}
export function loadMoreLog() {
  const had = P_CACHE.log
  if (P_CACHE.logMore || P_CACHE.logEnd || !had?.length) return
  P_CACHE.logMore = true
  const p = ctx.P
  net<LogRow[]>(p + `api/log?n=${LOG_MORE}&before=${seqOf(had[had.length - 1])}`, {}, NET.get).then(
    (l) => {
      P_CACHE.logMore = false
      const cur = P_CACHE.log
      if (p !== ctx.P || !cur?.length || seqOf(cur[cur.length - 1]) !== seqOf(had[had.length - 1]))
        return bump('project') // it started again meanwhile: the end asks again
      P_CACHE.log = [...cur, ...l.map(logText)]
      P_CACHE.logEnd = l.length < LOG_MORE
      bump('project')
    },
    () => {
      P_CACHE.logMore = false
      notLoaded('earlier changes', loadMoreLog)
      bump('project')
    },
  )
}
export async function loadProjects(once = false) {
  if (once && P_CACHE.projects) return
  try {
    const [live, gone] = (await Promise.all(
      ['/api/projects', '/api/projects/deleted'].map((u) => net(u, {}, NET.get)),
    )) as [ProjectRow[], typeof P_CACHE.trash]
    P_CACHE.projects = live
    P_CACHE.trash = gone
    DR.list = [...live].sort((a, b) => (b.t || 0) - (a.t || 0))
    keepProjects()
  } catch {
    return
  }
  bump('project', 'side')
}
export async function setFix(body: unknown) {
  const d = await net<{ ok: boolean; error?: string; corrections: typeof P_CACHE.fixes }>(
    '/api/corrections',
    JSON_POST(body),
    NET.op,
  )
  if (!d.ok) {
    toast(d.error || 'Not saved', null, { error: true })
    throw new Error()
  }
  P_CACHE.fixes = d.corrections
  bump('project')
}
// F183: how voice notes are written down, for every project. Edit puts the text into the one box; Save keeps it.
export function editPrefs() {
  if (!P_CACHE.prefs) return
  U.prefsEdit = { was: P_CACHE.prefs.text }
  U.amend = null
  U.correct = null
  render()
  const t = els.text
  if (!t) return
  if (!t.value.trim()) {
    t.value = P_CACHE.prefs.text
    saveDraft()
    bump('composer')
  }
  t.focus()
  t.selectionStart = t.selectionEnd = t.value.length
}
export function cancelPrefs() {
  U.prefsEdit = null
  render()
}
export async function sendPrefs() {
  const t = els.text
  if (!t) return
  const text = t.value.trim(),
    was = U.prefsEdit?.was ?? ''
  if (!text) return toast('Enter transcription rules, or press Esc to cancel')
  try {
    const d = await net<{ ok: boolean; error?: string; text: string; default: boolean; tidy?: boolean }>(
      '/api/voiceprefs',
      JSON_POST({ text }),
      NET.op,
    )
    if (!d.ok) return toast(d.error || 'Not saved', null, { error: true })
    P_CACHE.prefs = d
    U.prefsEdit = null
    t.value = ''
    U.files = []
    saveDraft()
    render()
    toast('Saved: applies to all projects', async () => {
      const b = await net<{ ok: boolean; text: string; default: boolean; tidy?: boolean }>(
        '/api/voiceprefs',
        JSON_POST({ text: was }),
        NET.op,
      )
      if (b.ok) {
        P_CACHE.prefs = b
        bump('project')
      }
    })
  } catch {
    toast('Connection lost. Your words are still in the box; try again.', null, { error: true })
  }
}

// ---------------------------------------------------------------- projects (F173)

export async function projectCall(what: string, body: unknown) {
  const d = await (await fetch(`/api/projects${what ? '/' + what : ''}`, JSON_POST(body))).json()
  if (!d.ok) throw new Error(d.error || 'Not saved')
  return d as { ok: true; name: string; title: string; was?: string }
}
export async function renameProject(slug: string, title: string) {
  const d = await projectCall('rename', { name: slug, title })
  if (slug === model.S.project) {
    model.S.title = d.title
    render()
  }
  await loadProjects()
  return d
}
// The projects you opened, the latest first, kept in this browser (T228 #2)
export function recentProjects(add?: string) {
  let list: string[] = []
  try {
    list = JSON.parse(localStorage.getItem('taska.recent') || '[]')
  } catch {
    /* nothing kept */
  }
  if (add) {
    list = [add, ...list.filter((n) => n !== add)].slice(0, 20)
    try {
      localStorage.setItem('taska.recent', JSON.stringify(list))
    } catch {
      /* no storage */
    }
  }
  return list
}
export async function deleteProject(slug: string) {
  if (slug === model.S.project) U.leaving = true
  let d
  try {
    d = await projectCall('delete', { name: slug })
  } catch (ex) {
    U.leaving = false
    throw ex
  }
  if (slug === model.S.project) {
    // this project is gone: on to another one, whose Projects offers it back
    const all = P_CACHE.projects || DR.list || [],
      seen = recentProjects().filter((n) => n !== slug && all.some((p) => p.name === n))
    const next =
      all.find((p) => p.name === seen[0]) ||
      [...all].filter((p) => p.name !== slug).sort((a, b) => (b.t || 0) - (a.t || 0))[0] // T228 #2
    try {
      sessionStorage.setItem('taska.deleted', JSON.stringify({ name: slug, title: d.title }))
    } catch {
      /* no storage */
    }
    navigate(next ? `/p/${encodeURIComponent(next.name)}/projects` : '/')
    return
  }
  await loadProjects()
  const title = d.title
  toast(`Deleted ${title}`, () =>
    projectCall('restore', { name: slug })
      .then(() => loadProjects())
      .then(
        () => toast(`${title} is back`),
        (ex) => toast((ex as Error).message),
      ),
  )
}
export async function saveRename(slug: string, title: string) {
  const was =
    slug === model.S.project
      ? projTitle()
      : titleOf((P_CACHE.projects || []).find((p) => p.name === slug) || { name: slug })
  title = title.trim()
  if (!title || title === was) {
    U.renaming = null
    return render()
  }
  try {
    U.renaming = null
    await renameProject(slug, title)
    toast(`Renamed to ${title}`, () =>
      renameProject(slug, was).then(
        () => toast(`Back to ${was}`),
        (ex) => toast((ex as Error).message),
      ),
    )
  } catch (ex) {
    U.renaming = slug
    render()
    toast((ex as Error).message)
  }
}
// F253: put the projects in your order; kept with Taska, for every page that lists them; Undo puts it back.
export async function saveProjOrder(names: string[], said: string): Promise<void> {
  const was = [...(DR.list || [])].sort(projOrder).map((p) => p.name)
  const put = (list: string[]) => {
    for (const p of DR.list || []) {
      const i = list.indexOf(p.name)
      if (i >= 0) p.pos = i
      else delete p.pos
    }
    keepProjects()
    bump('side')
  }
  put(names)
  try {
    await net('/api/projects/order', JSON_POST({ names }), NET.op)
  } catch {
    put(was)
    return toast('Order not saved', () => saveProjOrder(names, said), { error: true, label: 'Retry' })
  }
  toast(
    said,
    pushUndo(said, async () => {
      put(was)
      try {
        await net('/api/projects/order', JSON_POST({ names: was }), NET.op)
      } catch {
        /* the order stays as it is there */
      }
    }),
  )
}
export function projMove(slug: string, dir: number) {
  const names = [...(DR.list || [])].sort(projOrder).map((p) => p.name),
    i = names.indexOf(slug),
    j = i + dir
  if (i < 0 || j < 0 || j >= names.length) return toast(dir < 0 ? 'Already at top' : 'Already last project')
  names.splice(j, 0, names.splice(i, 1)[0])
  const p = (DR.list || []).find((p) => p.name === slug)
  saveProjOrder(names, `${p ? titleOf(p) : slug} moved ${dir < 0 ? 'up' : 'down'}`)
}
export async function newKey() {
  try {
    await net('/api/key', { method: 'POST' }, NET.op)
  } catch (ex) {
    return notSaved(ex)
  }
  try {
    await load()
  } catch {
    /* the next poll */
  }
  bump('project')
  toast('New key made')
}
