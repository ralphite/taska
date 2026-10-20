// A project's page starts here: what this browser kept is put back first (B190: the frame shows before the data),
// then the state loads, and the page follows the address, a walk goes on, unsent inputs and voice notes go out, and
// the page listens for changes (no reload by itself when Taska is updated: R284).
import { D, U, beforeRender, byN, code, ctx, desk, els, model, parseRef, setProject } from './state'
import { PSEC_AT, readURL, viewQuery, writeURL } from './url'
import { loadViews } from './views'
import { checkOthers, errorLog, loadKept, nextGeneration, poll, slowLog, VERSION } from './data'
import { restoreDraftFiles, syncDraft } from './drafts'
import { restoreGo, startGoFromAnotherProject } from './go'
import { applyURL, settleOpen } from './nav'
import { restoreOutbox } from './outbox'
import { restoreVoice } from './voice'
import { projectCall } from './settings'
import { toast } from './toast'
import { wire } from './events'
import { ACT } from './actions'
import { grow } from './outbox'
import type { Tab } from './constants'

export function bootProject(name: string) {
  setProject(name)
  beforeRender(settleOpen) // B5: never a merged item, whichever way it came back
  beforeRender(syncDraft) // the box follows what it writes to: its draft comes along (B185)
  U.draftKey = null
  U.parked = {}
  U.vcMarks = []
  restoreDraftFiles() // T257 #4
  try {
    U.oldDraft = localStorage.getItem('taska.draft') || ''
    localStorage.removeItem('taska.draft')
  } catch {
    /* no storage */
  }
  // B190: before the data the frame shows where it will be; a tab or filters in the address are read now too
  const { seg, qs } = readURL()
  if (Object.hasOwn(PSEC_AT, seg)) {
    const sec = PSEC_AT[seg]
    D.page = 'project'
    D.section = seg === 'settings' && !desk() ? null : sec === 'connect' ? 'agents' : sec
  } else if (desk()) {
    U.q = qs.get('q') || ''
    for (const k of ['type', 'when', 'status', 'pri', 'sort'] as const) U[k] = qs.get(k) || 'all'
    if (/^(inputs|archive|rules)$/.test(seg)) U.tab = seg as Tab
  }
  VERSION.page = document.querySelector<HTMLMetaElement>('meta[name="taska-version"]')?.content || ''
  if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {}) // F192
}
/** Once the page is drawn: listeners, the data, and everything that waits for it. */
export async function startProject() {
  wire()
  grow()
  const g = nextGeneration()
  try {
    await loadKept() // T293: the kept copy at once, then what changed since
  } catch {
    /* the poll tries again */
  }
  const up = Math.round(performance.now()) // F334: from the click that opened this page to its items being in
  if (up > 1000)
    slowLog(location.pathname, up, navigator.serviceWorker?.controller ? 'page load, kept page' : 'page load')
  // T335: a script error or a failed promise nobody caught goes to the log
  addEventListener('error', (e) =>
    errorLog(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`, 'script error'),
  )
  addEventListener('unhandledrejection', (e) =>
    errorLog(String((e.reason as Error)?.stack || e.reason).slice(0, 300), 'promise'),
  )
  void loadViews() // F320: your own views, the same in every project
  void checkOthers() // the other projects: the sidebar, and Move… on your inputs (A12)
  const S = model.S
  const { seg } = readURL(),
    n = /^[Dd]\d+$/.test(seg) ? 0 : parseRef(seg) // D1 is a document, not item 1
  if (history.state?.layers) history.replaceState({ ...history.state, layers: undefined }, '') // a sheet open before a reload is not open now (B150)
  if (n && byN.has(n) && !desk() && !history.state?.n) {
    // a link to an item on the phone: put the list under it, so Back lands there
    history.replaceState(null, '', ctx.P + viewQuery())
    history.pushState({ n }, '', ctx.P + code(n) + viewQuery())
  }
  try {
    // B301: back from another project to its plain address: the tab you were in there
    const t = sessionStorage.getItem('taska.tab.' + S.project),
      { seg: s0, qs: q0 } = readURL()
    if (!s0 && ![...q0.keys()].length && t && ['inputs', 'archive', 'rules'].includes(t))
      history.replaceState(history.state, '', ctx.P + t)
  } catch {
    /* no storage */
  }
  restoreGo() // a walk you were on goes on after a reload (T113 B17)
  startGoFromAnotherProject(() => ACT['go-through']({})) // or one that came over from another project (F193)
  applyURL()
  if (!desk()) {
    // a reload keeps your place in each tab of the list (B152)
    try {
      Object.assign(U.tabTop, JSON.parse(sessionStorage.getItem('taska.top.' + S.project) || '{}'))
    } catch {
      /* no storage */
    }
    const top = U.tabTop[U.tab] || 0
    if (U.open) U.listTop = U.tab === 'inputs' ? [U.tabTop.items || 0, top] : [top, U.tabTop.inputs || 0]
    else {
      const el = U.tab === 'inputs' ? els.inputsView : els.list
      if (el) el.scrollTop = top
    }
  }
  writeURL(false) // tidy the address: #B03 becomes /B03
  restoreOutbox() // inputs that did not go out last time (B151)
  try {
    // you deleted the project you were in: this is where you landed, and Undo brings it back (F173)
    const gone = JSON.parse(sessionStorage.getItem('taska.deleted') || 'null') as null | { name: string; title: string }
    if (gone) {
      sessionStorage.removeItem('taska.deleted')
      toast(`Deleted ${gone.title}`, () =>
        projectCall('restore', { name: gone.name }).then(
          () => location.assign(`/p/${encodeURIComponent(gone.name)}/`),
          (ex) => toast((ex as Error).message),
        ),
      )
    }
  } catch {
    /* no storage */
  }
  void restoreVoice() // voice notes that did not go out last time (T101)
  void poll(g)
}
