// Where you are on the page: the open item, the tab, Settings, full width, search; and the address that follows.
import { VIEW_KEYS, type Tab } from './constants'
import {
  talkScroller,
  D,
  DR,
  OV,
  U,
  bump,
  byN,
  code,
  ctx,
  desk,
  docById,
  els,
  inTab,
  liveN,
  needsYou,
  render,
  tabOf,
  wide,
} from './state'
import { hint, toast } from './toast'
import { stashEdit } from './edit'
import {
  PSEC_AT,
  URLS,
  hist,
  keepPlace,
  layerOpen,
  layerShut,
  leaveView,
  parseTarget,
  readFilters,
  readURL,
  restorePlace,
  searchStep,
  viewPath,
  viewQuery,
  writeURL,
  isPopping,
} from './url'
import { PSEC } from './settings-data'
import { closeDialog } from './dialog'
import { advance, peek } from './go'
import { openDoc } from './docs'
import { ACT } from './actions'
import { loadFixes, loadProjects, loadGuide } from './settings'
import { LIST } from './listhold'

// B5: a merged item lives on in the one it went into.
export function mergedTo(n: number) {
  const to = liveN(n)
  if (to !== n) toast(`${code(n)} was merged into ${code(to)}`)
  return to
}
export function settleOpen() {
  // the item on screen was merged: the one it went into takes its place
  if (!U.open || !byN.get(U.open)?.merged_into) return
  U.open = mergedTo(U.open)
  if (!URLS.applying) writeURL(false)
}

// Opening an item is a step in the browser's history on the phone; on the desktop it only selects it.
export function openItem(n: number | null | undefined, push = true) {
  if (!n || !byN.has(n)) return closeItem()
  const asked = n
  n = mergedTo(n)
  if (n !== asked && URLS.applying)
    history.replaceState(desk() ? history.state : { n }, '', ctx.P + code(n) + viewQuery())
  if (!U.open && !desk()) U.listTop = [els.list?.scrollTop || 0, els.inputsView?.scrollTop || 0]
  if (U.open !== n) {
    stashEdit()
    U.editing = null
    U.subFor = null
    U.amend = null
    U.correct = null
    U.prefsEdit = null
  }
  const fresh = U.open !== n
  U.open = n
  U.scopeOff = false
  if (desk() && U.doc && !U.docEdit) {
    U.docScroll[U.doc] = els.detailBody?.scrollTop || 0
    Object.assign(U, { doc: null, docReply: null, docSel: new Set(), docQuote: null, docCircle: false })
    D.docKey = null
  } // another item: the document closes
  if (desk() && U.tab === 'inputs') {
    const it = byN.get(n)
    if (it) U.tab = tabOf(it)
  } // Inputs has no item pane
  if (desk()) {
    D.page = null
    D.compose = false
    writeURL(false, history.state?.full ? { ...history.state, n } : null)
  } else if (push && !URLS.applying)
    hist(() => {
      if (location.pathname !== ctx.P + code(n))
        history.pushState({ n, ...searchStep() }, '', ctx.P + code(n) + viewQuery())
    })
  render()
  const body = talkScroller()
  if (fresh && body) body.scrollTop = desk() ? body.scrollHeight : 0
  if (fresh && desk())
    for (const ms of [120, 400, 1000])
      setTimeout(() => {
        const talk = talkScroller()
        if (U.open === n && !U.doc && talk) talk.scrollTop = talk.scrollHeight
      }, ms) // B279: the desktop opens an item at its latest message
  if (desk()) document.querySelector(`#list [data-act="open"][data-n="${n}"]`)?.scrollIntoView({ block: 'nearest' })
}
export function closeItem() {
  if (!U.open) return
  stashEdit()
  U.open = null
  U.editing = null
  U.subFor = null
  BK.pull = false
  D.full = false
  if (desk() && U.doc && !U.docEdit) {
    U.doc = null
    U.docReply = null
    D.docKey = null
  }
  writeURL(false, null)
  render()
  if (!desk() && els.list && els.inputsView) [els.list.scrollTop, els.inputsView.scrollTop] = U.listTop || [0, 0]
  if (!desk() && U.goBack) {
    // back from the item you opened while going through: the walk goes on where it was (B153)
    const w = U.goBack
    U.goBack = null
    requestAnimationFrame(() => {
      U.go = w.go
      const it = byN.get(w.n)
      if (it && needsYou(it) && !w.go.done.has(w.n)) peek(w.n, { focus: false })
      else advance(w.n)
    })
  }
}
export const BK = { pull: false }

export function clearSearch() {
  U.q = ''
  if (els.q) els.q.value = ''
  writeURL(false)
  bump('list', 'inputs', 'head')
}
export function setTab(t: Tab) {
  const was = U.tab,
    away = desk() && (t !== was || !!D.page || D.compose) // another tab, or out of Settings or New input: a step Back undoes (B9)
  if (away) keepPlace()
  let carried = false
  if (t !== was) {
    // B130: each tab keeps its own search and filters; words in the search box go along (T225 #13)
    const words = U.q.trim() ? U.q : ''
    U.tabView[was] = Object.fromEntries(VIEW_KEYS.map((k) => [k, U[k]]))
    const v = U.tabView[t] || {}
    for (const k of VIEW_KEYS) (U as Record<string, unknown>)[k] = v[k] ?? (k === 'q' ? '' : 'all')
    if (words) {
      U.q = words
      carried = true
    }
    if (els.q) els.q.value = U.q
  }
  U.asRule = null
  U.amend = null
  U.correct = null
  U.prefsEdit = null
  U.goBack = null
  const scrollOf = (k: string) => (k === 'inputs' ? els.inputsView : els.list)
  if (!desk() && t !== was && !U.open) U.tabTop[was] = scrollOf(was)?.scrollTop || 0 // B152
  U.tab = t
  if (t !== was && !desk()) writeURL(true)
  if (desk()) {
    if (t !== was) {
      // B120: the open item belongs to a tab; each tab keeps its own
      if (was !== 'inputs') U.tabOpen[was] = U.open
      if (t !== 'inputs') {
        const back = [U.tabOpen[t], U.open].find(
          (k) => k && byN.has(k) && inTab(byN.get(k) as NonNullable<ReturnType<typeof byN.get>>, t),
        )
        if (back !== U.open) U.open = back || null
      }
    }
    U.tabTop[was] = els.list?.scrollTop || 0 // each tab keeps its place in the list (B124)
    D.page = null
    D.sideOpen = false
    D.compose = false
    U.settle.clear()
    render()
    if (els.list) els.list.scrollTop = carried ? 0 : U.tabTop[t] || 0
    return writeURL(away)
  }
  render()
  const el = scrollOf(t)
  if (t !== was && el) el.scrollTop = carried ? 0 : U.tabTop[t] || 0
}
export function searchMode(on: boolean) {
  if (on !== !!U.searching) {
    if (on) layerOpen('search')
    else layerShut('search')
  } // Back closes it (B150)
  U.searching = on
  if (!on) {
    // Cancel ends the search: on every tab, and in the address (B152)
    U.q = ''
    if (els.q) els.q.value = ''
    for (const v of Object.values(U.tabView)) v.q = ''
    if (!isPopping()) writeURL(false)
  }
  render()
  if (on) els.q?.focus()
}
export function fullWidth(on: boolean) {
  if (!U.open || on === D.full) return
  const doc = desk() && U.doc && !U.docEdit ? `D${U.doc}` : null // a document open over its item goes full width itself (T113 B20)
  if (on) {
    keepPlace()
    D.full = true
    history.pushState(
      { n: U.open, full: true, ...(doc ? { v: doc } : {}) },
      '',
      ctx.P + (doc || code(U.open)) + viewQuery(),
    )
    render()
  } else if (history.state?.full && !history.state.link)
    history.back() // popstate leaves full width
  else {
    D.full = false
    render()
    if (history.state?.full) writeURL(false, null)
  } // reached by a link (B9): Back goes to where it was
}
// J / K and the arrows in the detail bar walk the rows as the list shows them.
export function stepItem(dir: number) {
  const now = [...document.querySelectorAll<HTMLElement>('#list [data-act="open"][data-n]')].map((el) =>
    Number(el.dataset.n),
  )
  const from =
    U.stepFrom?.n === U.open
      ? U.stepFrom.rows // you just settled it and it moved: go on from where it was (B124)
      : !now.includes(U.open || -1) && LIST.at?.n === U.open
        ? LIST.at.rows
        : null // it left the list some other way: the same (T113 A14)
  U.stepFrom = null
  if (from) {
    const i = from.indexOf(U.open || -1),
      next = (dir > 0 ? from.slice(i + 1) : from.slice(0, i).reverse()).find((k) => now.includes(k))
    if (next) return openItem(next)
  }
  const rows = now
  if (!rows.length) return
  const i = rows.indexOf(U.open || -1),
    n = rows[i < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + dir))]
  if (n !== U.open) openItem(n)
  else hint(dir < 0 ? 'This is the first item' : 'This is the last item')
}
export function toList() {
  // T268: Settings, full width or Inputs give way to the list
  if (!desk()) return
  if (D.page) D.page = null
  if (D.full) D.full = false
  if (U.tab === 'inputs') return setTab('items')
  render()
  writeURL(false)
}
export function leaveCompose() {
  // back where you were: the Inputs page, or the item you had open
  els.text?.blur()
  const p = D.prev,
    tab = D.prevTab,
    doc = D.prevDoc
  D.compose = false
  D.prev = null
  D.prevTab = null
  D.prevDoc = null
  if (tab) {
    U.tab = tab
    U.open = p && byN.has(p) ? p : null
  }
  const back = leaveView(/^new(-rule)?$/.test(history.state?.v) ? history.state.v : 'new')
  if (p && byN.has(p) && !tab) openItem(p)
  else {
    render()
    if (!back) writeURL(false)
  }
  const dd = doc ? docById(doc) : undefined
  if (doc && dd && U.open === liveN(dd.n)) {
    // B14: back into the document you came from
    Object.assign(U, { doc, docReply: null, docSel: new Set(), docQuote: null, docCircle: false })
    D.docKey = null
    render()
    if (els.detailBody) els.detailBody.scrollTop = U.docScroll[doc] || 0
    if (!back) writeURL(false)
  }
}
// Opening a section is a step Back undoes; history.state.page counts the steps, so Back to Items undoes them all.
// sec null: the phone's Settings page, the list of sections.
export function openProject(sec: string | null) {
  const part = sec === 'connect' ? 'pConnect' : null
  sec =
    sec === 'connect'
      ? 'agents'
      : sec === 'about'
        ? 'projects'
        : sec && Object.hasOwn(PSEC, sec)
          ? sec
          : desk()
            ? 'agents'
            : null
  const was = !!D.page,
    from = was ? D.section : undefined
  if (from !== sec) keepPlace() // B9
  if (!desk() && !was && U.open) {
    stashEdit()
    U.open = null
    U.editing = null
    U.subFor = null
  }
  D.page = 'project'
  D.sideOpen = false
  D.section = sec
  if (sec !== 'projects') {
    U.pMenu = null
    U.pNew = false
    U.renaming = null
  }
  render()
  if (from !== sec) {
    const el = sec || desk() ? els.projectBody : els.projectNav
    if (el) el.scrollTop = 0
    writeURL(true, { v: viewPath(), page: was ? (history.state?.page || 0) + 1 : 1, tab: U.tab })
  }
  if (sec === 'agents') loadGuide()
  loadFixes(true)
  if (sec === 'projects') loadProjects()
  else loadProjects(true)
  if (part) requestAnimationFrame(() => document.getElementById(part)?.scrollIntoView({ block: 'start' }))
}
// The phone's back on a page of Settings: back where you came from when that was a step here, else one level up.
export function pageUp() {
  if (history.state?.page) return hist(() => history.back())
  if (D.section) D.section = null
  else D.page = null
  render()
  writeURL(false)
}
export function projectBack() {
  if (!desk()) return pageUp()
  const k = !URLS.applying && history.state?.page
  D.page = null
  render()
  if (k) {
    URLS.selfBack = true
    history.go(-k)
  } else writeURL(false)
}
export function closeDrawer() {
  if (desk()) {
    if (D.sideOpen) {
      D.sideOpen = false
      render()
    }
    return
  }
  if (DR.open) layerShut('drawer')
  DR.open = false
  bump('side', 'view', 'toast')
}

// The page follows the address: when it loads, and on Back / Forward
export function applyURL() {
  URLS.applying = true
  try {
    showURL()
  } finally {
    URLS.applying = false
  }
  restorePlace()
}
function showURL() {
  const { seg, qs } = readURL()
  readFilters(qs)
  if (desk()) {
    D.full = !!history.state?.full
    D.compose = false
  }
  D.page = null
  const t = parseTarget(seg)
  if (t.doc == null && U.doc && OV.spec) closeDialog()
  if (t.doc != null) {
    const d = docById(t.doc)
    if (d && !U.open && desk()) openItem(d.n, false)
    return openDoc(t.doc)
  }
  if (t.item) {
    U.tab = t.tab
    return openItem(t.item, false)
  } // a merged item: the one it went into (B5)
  closeItem()
  if (t.section) {
    // a page of Settings; /settings is Agents on the desktop, the list of sections on the phone
    if (desk()) {
      if (history.state?.tab) U.tab = history.state.tab
    } else U.tab = history.state?.tab || 'items'
    return openProject(seg === 'settings' && !desk() ? null : PSEC_AT[seg])
  }
  if (seg === 'new-rule') {
    U.tab = 'rules'
    U.asRule = null
  } // B10: New rule has its own address
  else if (seg === 'new' && U.tab === 'rules') U.asRule = false
  if (t.compose) {
    if (desk()) return ACT['new-input']({})
    render()
    els.text?.focus()
    return
  }
  const was = U.tab
  const scrollOf = (k: string) => (k === 'inputs' ? els.inputsView : els.list)
  if (!desk()) U.tabTop[was] = scrollOf(was)?.scrollTop || 0 // Back or Forward to another tab: each keeps its place (B152)
  U.tab = t.tab
  U.asRule = null
  render()
  const el = scrollOf(U.tab)
  if (!desk() && U.tab !== was && el) el.scrollTop = U.tabTop[U.tab] || 0
}
export const sideToggle = () => {
  if (wide()) {
    D.sideHidden = !D.sideHidden
    try {
      localStorage.setItem('taska.sideHidden', D.sideHidden ? '1' : '')
    } catch {
      /* no storage */
    }
  } else D.sideOpen = !D.sideOpen
  render()
}
