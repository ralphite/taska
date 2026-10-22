// Every action on the page, by name. A button calls act(name, data); the Markdown in messages carries data-act
// attributes, which one listener sends here too. A handler that returns a promise keeps its button busy (B159).
import {
  CLOSED,
  D,
  DR,
  OV,
  R_STATE as R,
  U,
  bump,
  answerOf,
  byN,
  byR,
  code,
  ctx,
  dcFind,
  desk,
  wide,
  detailShown,
  docById,
  docOpen,
  els,
  inTab,
  kids,
  liveN,
  model,
  otherProjects,
  parseRef,
  plural,
  projName,
  rcode,
  render,
  standN,
  tabOf,
  visible,
  type Go,
} from './state'
import { CHOICE, groups, hasChoices } from './markdown'
import { clearTicks, tickDoc, tickModify } from './doctick'
import { playAudio } from './audio'
import { FAILED, addFailed, dropFailed, retryFailed, toast } from './toast'
import type { Item } from './types'
import { actLog } from './actlog'
import {
  JSON_POST,
  NET,
  change,
  load,
  net,
  notLoaded,
  notSaved,
  op,
  optimistic,
  instant,
  postAgain,
  pushUndo,
  revertNow,
  save,
  undoMine,
  fillDrawer,
  refresh,
  signIn,
} from './data'
import { carry, carryDraft, kept, keepChoice, saveDraft } from './drafts'
import { closeDialog, confirmClick, openDialog, popAt } from './dialog'
import {
  closeDrawer,
  closeItem,
  fullWidth,
  leaveCompose,
  openItem,
  openProject,
  openSide,
  projectBack,
  searchMode,
  setTab,
  sideToggle,
  stepItem,
  clearSearch,
} from './nav'
import { advance, endGoDesk, endWalk, goResume, goThroughPhone, peek, startGoDesk } from './go'
import { closeDoc, deleteComment, docTarget, editComment, newDoc, openDoc, renderDoc, saveDoc } from './docs'
import { flushOutbox, send, sendChoice } from './outbox'
import {
  cancelRec,
  docRecStart,
  docRecStop,
  docSay,
  docVoiceSettled,
  doubtPick,
  dropRec,
  finishRec,
  hear,
  holdRec,
  keepRec,
  pageSay,
  startRec,
  vcToggle,
  DV,
} from './voice'
import { keepPlace, layerOpen, writeURL, URLS } from './url'
import {
  P_CACHE,
  cancelPrefs,
  deleteProject,
  editPrefs,
  loadProjects,
  newKey,
  projMove,
  projectCall,
  saveRename,
  setFix,
} from './settings'
import { paletteRun } from './keys'
import { pushOff, pushOn, turnOnNotices, noticeRead, noticeWrite, PUSH } from './notices'
import { stashEdit } from './edit'
import { copy, copyItem } from './copy'
import { VW_STATE, deleteView, saveView, updateView, showView } from './views'
import { openViewer, viewerAct } from './viewer'
import { navigate } from './switch'

export type Data = Record<string, string | undefined>
export type KeyLike = { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; target?: EventTarget | null }
type Handler = (d: Data, e?: KeyLike) => unknown

const N = (d: Data) => Number(d.n)
const fieldValue = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value || ''
export const reply = () => {
  U.scopeOff = false
  bump('composer')
  els.text?.focus()
}
// Edit or add details to an input you sent (B136): the one input box does it.
export function editInput(id: string, mode: 'edit' | 'append') {
  const r = byR.get(id)
  if (!r || r.moved) return
  U.amend = { id, mode, v: r.v || 0 }
  render()
  const t = els.text
  if (!t) return
  if (mode === 'edit' && !t.value.trim()) {
    t.value = r.text
    saveDraft()
    bump('composer')
  }
  t.focus()
  t.selectionStart = t.selectionEnd = t.value.length
}
// Make item's title (T113 A25): the first line, or when that is long, its first sentence, or its first words.
function shortTitle(s: string) {
  s = String(s || '').trim()
  if (s.length <= 80) return s
  const m = s.slice(0, 81).match(/^.{12,79}?(?:[.!?](?=\s)|[。！？])/u)
  if (m) return m[0].replace(/[.。]$/u, '')
  const cut = s.slice(0, 80),
    sp = cut.lastIndexOf(' ')
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:，；：]+$/u, '') + '…'
}
export const deletedSaid = (x: (typeof model.S.deleted)[number] | undefined, id: string) => {
  if (!x) return `Deleted ${rcode(id)}`
  const k = x.kept
  return `Deleted ${rcode(id)}${x.items.length ? ` and ${x.items.map((i) => i.code).join(', ')}` : ''}${k.length ? ` · ${k[0].code} kept: ${k[0].why}${k.length > 1 ? ` · ${k.length - 1} more kept` : ''}` : ''}`
}
export function itemMenu(n: number | null, arm: string | null = '') {
  if (n == null) return
  if (desk()) return itemMenuDesk(n, arm)
  if (!byN.get(n)) return
  U.sheet = arm && ['s', 'p', 't'].includes(arm) ? 'pick' : 'menu'
  openDialog('menu', { n, arm: arm || '' }, { focus: false })
}
// The ... menu on the desktop: a popover with the actions as rows, each with its key, then type, priority, status.
export function itemMenuDesk(n: number | null, arm: string | null = U.menuArm) {
  if (n == null || !byN.get(n)) return
  const field = !!arm && ['s', 'p', 't'].includes(arm)
  const again = (U.sheet === 'menu' || U.sheet === 'pick') && !!OV.spec && U.menuFor === n
  U.sheet = field ? 'pick' : 'menu' // B358: a field's list closes when you pick
  U.menuFor = n
  U.menuArm = arm
  const xy = again ? OV.popXY : null
  openDialog('menu-desk', { n }, { pop: true, focus: false, narrow: field })
  if (xy) OV.popXY = xy
  bump('dialog')
}
export function showFilters() {
  if (desk()) {
    D.filters = !D.filters
    return render()
  }
  U.sheet = 'filter'
  openDialog('filters', {}, { focus: false })
}
export function movePicker(n: number) {
  U.sheet = 'move'
  openDialog('move', { n }, { pop: true, focus: false })
}
export function itemPicker(head: string, act: string, data: Data, skip: number[] = []) {
  openDialog('pick', { head, act, data, skip }, { pop: true, focus: false })
}
export function projectMenu(slug: string = model.S.project, at: [number, number] | null = null) {
  U.sheet = 'projmenu'
  openDialog('proj-menu', { slug }, { pop: true, focus: false })
  if (at) popAt(...at)
  else {
    const r = document.getElementById('projMenuBtn')?.getBoundingClientRect()
    if (r) popAt(r.left, r.bottom + 6)
  }
}
export function inputMenu(id: string, at?: DOMRect) {
  if (!byR.get(id)) return
  openDialog('input-menu', { id }, { pop: true, focus: false })
  if (at && desk()) popAt(at.left, at.bottom + 4)
}

/** A1 (T422): a field you type in is fully in sight in its scrolling part, above the fade at that part's bottom. */
function fieldInSight(f: HTMLElement) {
  let sc = f.parentElement
  while (sc && !(sc.scrollHeight > sc.clientHeight && /auto|scroll/.test(getComputedStyle(sc).overflowY)))
    sc = sc.parentElement
  if (!sc) return
  const r = f.getBoundingClientRect(),
    c = sc.getBoundingClientRect(),
    fade = sc.hasAttribute('data-over') ? 72 : 8 // the part fades over its last 4rem
  if (r.bottom > c.bottom - fade) sc.scrollTop += r.bottom - (c.bottom - fade)
  else if (r.top < c.top) sc.scrollTop -= c.top - r.top + 8
}
// B15 (T422): a restored row leaves the list and the next one slides under the pointer: a second click right after
// is not taken as restoring that one too
let restoredAt = 0
function restoredJustNow() {
  const now = Date.now(),
    was = now - restoredAt < 700
  restoredAt = now
  return was
}
export const ACT: Record<string, Handler> = {
  search: () => searchMode(!U.searching),
  'search-cancel': () => searchMode(false),
  'search-clear': () => {
    clearSearch()
    els.q?.focus()
  },
  reply: () => reply(),
  'reply-instead': () => carry(reply), // A8: what you wrote goes along
  'new-input-instead': () => carry(() => ACT['new-input']({})),
  'card-answer': (d) => {
    // the card's step forward on an item that waits on you (B147): its question, and the box to reply in
    const it = byN.get(N(d))
    document.querySelector('#dlgBody [data-need]')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    if (it?.wait && (it.wait.kind === 'block' || !hasChoices(it.wait.text))) reply()
  },
  status: (d) => {
    const n = N(d)
    change(n, 'status', d.v)
    if (U.peek === n) advance(n) // the next card, or the card of one item closes (B153)
  },
  'settle-undo': (d) => {
    const s = U.settle.get(N(d))
    U.settle.clear()
    void s?.undo()
    bump('list')
  },
  'row-act': (d) => {
    // Accept and Approve happen at once (with Undo); Answer and Reply open the item (desktop) or its card (phone)
    const n = N(d),
      v = d.v
    if (v === 'accept' || v === 'approve') {
      change(n, 'status', v === 'accept' ? 'done' : 'open')
      return
    }
    if (!desk()) U.go = null
    if (desk()) {
      openItem(n)
      const first =
        v === 'answer' && document.querySelector<HTMLElement>(`#detailBody [data-act="choice"][data-n="${n}"]`)
      return first ? first.focus() : els.text?.focus()
    }
    peek(n)
    if (v === 'reply' || !hasChoices(byN.get(n)?.wait?.text)) els.text?.focus()
  },
  'go-through': () => (desk() ? startGoDesk() : goThroughPhone()),
  'go-prev': () => {
    const g = U.go
    if (!g) return
    if (!desk()) {
      const i = g.list.indexOf(U.peek ?? -1)
      if (i > 0 && byN.get(g.list[i - 1])) peek(g.list[i - 1], { focus: false })
      return
    }
    if (!g.list.includes(U.open ?? -1) || U.tab !== 'items' || D.page || D.compose) return goResume()
    const i = g.list.indexOf(U.open ?? -1)
    if (i <= 0) return toast('This is the first one')
    openItem(g.list[i - 1])
  },
  'go-resume': () => goResume(),
  'go-end': () => {
    if (desk()) return endGoDesk('end')
    U.go = null
    render()
  },
  'go-undo': (d) => {
    void U.go?.undo[N(d)]?.()
  },
  'go-next': () => {
    if (desk()) {
      const g = U.go
      if (!g) return startGoDesk()
      if (!g.list.includes(U.open ?? -1) || U.tab !== 'items' || D.page || D.compose) return goResume()
      const i = g.list.indexOf(U.open ?? -1),
        next = g.list.slice(i + 1).find((k) => byN.get(k) && needsYouN(k) && !g.done.has(k))
      return next ? openItem(next) : endGoDesk('last')
    }
    const g = U.go,
      i = g ? g.list.indexOf(U.peek ?? -1) : -1
    const next = g && g.list.slice(i + 1).find((k) => byN.get(k) && needsYouN(k) && !g.done.has(k))
    if (next) peek(next, { focus: false })
    else if (g) endWalk()
  },
  prev: () => stepItem(-1),
  next: () => stepItem(1),
  full: () => fullWidth(!D.full),
  side: () => sideToggle(),
  keys: () => openDialog('keys'),
  switch: () => openDialog('switch', {}, { focus: false }),
  'new-voice': () => {
    // F396: New input, recording at once (as ⇧V)
    if (R.rec) return void finishRec(true)
    ACT['new-input']({})
    return void startRec()
  },
  'new-input': () => {
    U.side = null // T402
    U.amend = null
    U.correct = null
    U.prefsEdit = null // New input is always a fresh new input (B168)
    D.sideOpen = false
    if (D.page) D.page = null
    if (desk()) {
      // the New input page; from a document, Back goes to the document (B14)
      if (U.tab === 'inputs') {
        D.prevTab = 'inputs'
        U.tab = 'items'
      }
      if (U.open) D.prev = U.open
      D.prevDoc = U.doc && !U.docEdit && docById(U.doc) ? U.doc : null
      if (D.prevDoc) {
        U.docScroll[U.doc as number] = els.detailBody?.scrollTop || 0
        Object.assign(U, { doc: null, docReply: null, docSel: new Set(), docQuote: null, docCircle: false })
        D.docKey = null
      }
      U.open = null
      U.editing = null
      U.subFor = null
      D.full = false
      D.compose = true
      writeURL(true)
    }
    U.scopeOff = true
    render()
    els.text?.focus()
  },
  'compose-back': () => leaveCompose(),
  'project-back': () => projectBack(),
  project: () => {
    if (!desk()) closeDrawer()
    if (U.sheet === 'projmenu') closeDialog()
    openProject(desk() ? 'agents' : null)
  },
  psec: (d, e) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) return window.open(`${ctx.P}${d.path || ''}`, '_blank')
    if (!desk() && DR.open) closeDrawer()
    if (desk() && /^(docs|log|deleted)$/.test(String(d.sec))) return openSide(d.sec as 'docs') // T402
    openProject(d.sec || null)
  },
  'notifications-on': () => turnOnNotices(),
  'notifications-quiet': () => {
    noticeWrite('quiet', !noticeRead('quiet', true))
    bump('project')
    if (!desk() && PUSH.sub) pushOn()
  },
  'push-on': () => pushOn(),
  'push-off': () => pushOff(),
  // B443: Not yet goes back to in progress at once, wherever you tap it; what you wrote in the box for it goes along
  reopen: (d) => change(N(d), 'status', 'doing', { said: 'is back in progress' }),
  'card-copy': (d) => copyItem(N(d)),
  projects: () => openDrawer(),
  'go-input': (d) => {
    // B131: from an item's source to that input in Inputs, lit up for a moment
    const id = d.id as string
    closeDialog()
    if (D.page && !desk()) keepPlace()
    if (D.page) D.page = null
    if (!desk() && U.open) {
      stashEdit()
      U.open = null
      U.editing = null
      U.subFor = null
    }
    if (desk()) U.inSel = id
    if (U.tab !== 'inputs') setTab('inputs')
    else {
      render()
      if (!desk()) writeURL(true)
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.querySelector(`#inputsView [data-ri="${id}"]`)?.scrollIntoView({ block: 'nearest' })
        const a = document.querySelector(`:is(#inputsView, #detailBody) [data-r="${id}"]`)
        if (!a) return
        a.scrollIntoView({ block: 'center' })
        a.classList.add('bg-blue-50', 'dark:bg-blue-400/10')
        setTimeout(() => a.classList.remove('bg-blue-50', 'dark:bg-blue-400/10'), 1600)
      }),
    )
  },
  'proj-menu': () => projectMenu(),
  'proj-manage': () => {
    closeDialog()
    openProject('projects')
  },
  'proj-up': (d) => {
    closeDialog()
    projMove(d.slug as string, -1)
  },
  'proj-down': (d) => {
    closeDialog()
    projMove(d.slug as string, 1)
  },
  'proj-open': (d) => {
    closeDialog()
    navigate(`/p/${encodeURIComponent(d.slug as string)}/`)
  },
  'proj-settings': (d) => {
    closeDialog()
    navigate(`/p/${encodeURIComponent(d.slug as string)}/settings`)
  },
  'proj-new': () => {
    closeDialog()
    ACT['new-project']({})
  },
  'new-project': () => {
    // B131: the button becomes a name field in place; Enter makes it, Esc stops
    if (desk() && !D.page && (D.sideHidden || !wide())) D.sideOpen = true // from the rail or the bar's menu: the sidebar comes over the page (F173)
    U.npOpen = true
    U.npErr = ''
    render()
    requestAnimationFrame(() => document.getElementById('npName')?.focus())
  },
  'np-create': async (d) => {
    const title = (d.title ?? fieldValue('npName')).trim() // any name (F173)
    if (!title) return document.getElementById('npName')?.focus()
    try {
      const r = await net<{ ok: boolean; name: string; error?: string }>('/api/projects', JSON_POST({ title }), NET.op)
      if (r.ok) navigate(`/p/${r.name}/`)
      else {
        U.npErr = r.error || 'Not created'
        bump('side')
      }
    } catch {
      U.npErr = 'Connection lost; try again'
      bump('side')
    }
  },
  'np-cancel': () => {
    U.npOpen = false
    U.npErr = ''
    bump('side')
  },
  'p-new': () => {
    U.pNew = true
    U.pErr = ''
    U.renaming = null
    U.pMenu = null
    bump('project')
    requestAnimationFrame(() => document.getElementById('pNewName')?.focus())
  },
  'p-new-cancel': () => {
    U.pNew = false
    U.pNewText = ''
    U.pErr = ''
    bump('project')
  },
  'p-create': async (d) => {
    const title = (d.title ?? fieldValue('pNewName')).trim()
    if (!title) return document.getElementById('pNewName')?.focus()
    try {
      const r = await projectCall('', { title })
      navigate(`/p/${encodeURIComponent(r.name)}/`)
    } catch (ex) {
      U.pErr = (ex as Error).message
      U.pNewText = title
      bump('project')
      requestAnimationFrame(() => document.getElementById('pNewName')?.focus())
    }
  },
  'p-rename': (d) => {
    U.renaming = d.slug || null
    U.pNew = false
    U.pMenu = null
    bump('project', 'side')
    requestAnimationFrame(() => {
      const f = document.getElementById('pRename') as HTMLInputElement | null
      if (f) {
        f.focus()
        f.select()
      }
    })
  },
  'p-rename-save': () => {
    // the phone's Save; Enter does the same
    const f = document.getElementById('pRename') as HTMLInputElement | null
    if (f) void saveRename(f.dataset.slug as string, f.value)
  },
  'cp-run': (d) => {
    if (d.n) {
      closeDialog()
      return openItem(Number(d.n))
    }
    paletteRun(d.k || '')
  },
  'p-rename-cancel': () => {
    U.renaming = null
    bump('project', 'side')
  },
  'p-more': (d) => {
    const k = d.key || null
    U.pMenu = U.pMenu === k ? null : k
    U.renaming = null
    bump('project')
  },
  'p-delete': async (d) => {
    U.pMenu = null
    try {
      await deleteProject(d.slug as string)
    } catch (ex) {
      toast((ex as Error).message)
    }
  },
  'p-restore': async (d) => {
    try {
      const r = await projectCall('restore', { name: d.slug })
      U.pMenu = null
      await loadProjects()
      toast(`${r.title} is back`)
    } catch (ex) {
      toast((ex as Error).message)
    }
  },
  'p-purge': async (d) => {
    if (!confirmClick('purge ' + d.slug)) return
    try {
      await projectCall('purge', { name: d.slug })
      U.pMenu = null
      await loadProjects()
      toast('Deleted for good')
    } catch (ex) {
      toast((ex as Error).message)
    }
  },
  guide: () => openProject('connect'),
  'agent-info': () => openProject('agents'),
  // T424 step 3: the list of changes that did not go in
  'failed-open': () => (FAILED.length ? openDialog('failed', {}, { pop: true, focus: false }) : undefined),
  'failed-retry': (d) => {
    retryFailed(d.id ? Number(d.id) : undefined)
    if (!FAILED.length) closeDialog()
  },
  'failed-drop': (d) => {
    dropFailed(d.id ? Number(d.id) : undefined)
    if (!FAILED.length) closeDialog()
  },
  about: () => openProject('about'),
  phone: () => openProject('phone'),
  'new-key': async () => {
    if (!confirmClick('new-key')) return
    await newKey()
  },
  log: () => openProject('log'),
  deleted: () => openProject('deleted'),
  'input-delete': (d) => {
    // F177: to Deleted, with the items only it made; Undo and Z put it back. R409: gone at once
    const id = d.id as string,
      snap = byR.get(id)
    const gone = () => {
      model.S.inputs = model.S.inputs.filter((r) => r.id !== id)
      byR.delete(id)
    }
    void instant({ op: 'delete', id }, gone, `deleting ${rcode(id)}`, () => ACT['input-delete'](d))
    const run = pushUndo(`${rcode(id)} deleted`, async () => {
      const ok = await instant({ op: 'restore', id }, () => {
        if (snap && !byR.has(id)) {
          model.S.inputs.push(snap)
          byR.set(id, snap)
        }
      })
      if (!ok) return false
      const x = (model.S.deleted || []).find((x) => x.id === id)
      toast(`${rcode(id)} is back${x?.items.length ? ` with ${x.items.map((i) => i.code).join(', ')}` : ''}`)
    })
    toast(`Deleted ${rcode(id)}`, run)
  },
  'input-restore': async (d) => {
    if (restoredJustNow()) return
    const id = d.id as string,
      x = (model.S.deleted || []).find((x) => x.id === id)
    try {
      await save({ op: 'restore', id }, () => ACT['input-restore'](d))
    } catch {
      return
    }
    const run = pushUndo(`${rcode(id)} restored`, async () => {
      try {
        await save({ op: 'delete', id }, run)
      } catch {
        return false
      }
      toast(
        deletedSaid(
          (model.S.deleted || []).find((x) => x.id === id),
          id,
        ),
      )
    })
    toast(`${rcode(id)} is back${x?.items.length ? ` with ${x.items.map((i) => i.code).join(', ')}` : ''}`, run)
  },
  tab: (d) => setTab(d.tab as never),
  filters: () => showFilters(),
  'set-filter': (d) => {
    if (U.tab === 'archive' && d.k === 'status' && d.views !== undefined) setTab('items') // F348: from the Archive view to another view
    ;(U as Record<string, unknown>)[d.k as string] = d.v
    writeURL(false)
    render()
    if (!desk() && els.list) els.list.scrollTop = 0
  },
  unfilter: (d) => {
    ;(U as Record<string, unknown>)[d.k as string] = 'all'
    writeURL(false)
    render()
  },
  reset: () => {
    U.q = ''
    U.type = 'all'
    U.when = 'all'
    U.status = 'all'
    U.pri = 'all'
    U.sort = 'all'
    if (els.q) els.q.value = ''
    writeURL(false)
    render()
  },
  open: (d, e) => {
    const n = N(d)
    if (desk() && e && (e.metaKey || e.ctrlKey || e.shiftKey) && d.inList) return pickRow(n, !!e.shiftKey)
    openItem(n)
  },
  'sel-do': (d) => batchSet(d.f as string, JSON.parse(d.v as string), d.said as string),
  'sel-clear': () => {
    U.sel.clear()
    bump('list')
  },
  back: () => {
    if (desk()) return fullWidth(false)
    if (history.state?.n) history.back()
    else closeItem()
  },
  'item-menu': (d) => itemMenu(U.open, d.arm || null),
  'do-next': (d) => {
    // F197: first of its priority in the agent's queue, or back where it was; with Undo and Z
    const n = N(d),
      it = byN.get(n)
    if (!it) return
    change(n, 'rank', it.rank == null ? -Math.round(Date.now() / 1000) : null) // the latest "next" goes first
    if (U.sheet === 'menu' && OV.spec) closeDialog()
  },
  'set-field': (d) => {
    // type, priority and status from the ... menu: with Undo and Z (T113 A7)
    const n = N(d)
    if (U.sheet === 'pick') closeDialog() // B302
    void change(n, d.f as string, d.v)
  },
  goto: (d) => {
    // from a chip, a source, a subitem, the change log or Make item: to the item, leaving pages that hide it
    const walk = !desk() && U.go && U.peek && OV.spec ? { go: U.go as Go, n: U.peek } : null // B153
    closeDialog()
    const n = N(d),
      it = byN.get(liveN(n))
    if (!desk()) {
      if (D.page) {
        keepPlace()
        D.page = null
      }
      openItem(n)
      U.goBack = walk
      return
    }
    keepPlace() // B9
    URLS.hold = true
    try {
      D.page = null
      D.compose = false
      if (it && (U.tab === 'inputs' || !inTab(it, U.tab))) setTab(tabOf(it))
      openItem(n)
    } finally {
      URLS.hold = false
    }
    writeURL(true, D.full ? { n: U.open, full: true, link: true } : undefined)
  },
  'more-input': (d) => {
    const id = d.id as string
    if (U.moreInputs.has(id)) U.moreInputs.delete(id)
    else U.moreInputs.add(id)
    bump('inputs', 'detail')
  },
  'in-pick': (d) => {
    U.inSel = d.id || null
    render()
  },
  edit: (d) => {
    closeDialog()
    const n = N(d)
    if (U.open !== n || !detailShown()) {
      if (desk() && U.tab === 'inputs') setTab(byN.get(n)?.type === 'rule' ? 'rules' : 'items')
      openItem(n)
    }
    U.editing = n
    render()
    const k = kept('edits')[n] as { title: string; body: string; next: string } | undefined,
      body = document.getElementById('eBody') as HTMLTextAreaElement | null
    const t = document.getElementById('eTitle') as HTMLInputElement | null,
      nx = document.getElementById('eNext') as HTMLInputElement | null
    if (k && t && body && nx) {
      t.value = k.title
      body.value = k.body
      nx.value = k.next
      toast('Your unsaved changes are back')
    }
    if (body) {
      body.focus()
      body.selectionStart = body.selectionEnd = body.value.length
    } // write on after the text, not before it
  },
  'edit-cancel': () => {
    const n = U.editing
    kept('edits', (all) => {
      if (n != null) delete all[n]
    })
    U.editing = null
    bump('detail', 'composer')
  },
  'edit-save': async (d) => {
    const n = N(d)
    const it = byN.get(n),
      was = it && { title: it.title, body: it.body, next: it.next },
      ref = code(n)
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
    try {
      await save(
        { op: 'set', ref, f: { title: val('eTitle'), body: val('eBody'), next: val('eNext') } },
        () => document.getElementById('eTitle') && ACT['edit-save'](d),
      )
      kept('edits', (all) => delete all[n])
      U.editing = null
      render()
    } catch {
      return
    }
    toast(
      'Saved',
      was
        ? pushUndo(`${ref} edited`, async () => {
            await save({ op: 'set', ref, f: was })
            toast(`${ref} put back`)
          })
        : null,
    ) // T257 #2: Z puts back this edit
  },
  copy: (d) => {
    closeDialog()
    copyItem(N(d))
  },
  'peek-set': (d) => {
    const n = N(d),
      f = d.f as string,
      going = !!U.go
    if (!going) closeDialog()
    change(n, f, f === 'archived' ? d.v === 'true' : d.v)
    if (going) advance(n)
  },
  'doc-open': (d) => openDoc(Number(d.d)),
  'doc-at': (d) => {
    // T274 #4: from the item's stream to that comment in its document
    const dn = Number(d.d),
      key = d.key as string
    openDoc(dn)
    if (key !== 'doc') {
      U.docThreads.add(key)
      D.docKey = null
      render()
    }
    requestAnimationFrame(() =>
      document
        .querySelector(
          key === 'doc' ? '#detailBody section:last-of-type' : `#docBlocks [data-key="${CSS.escape(key)}"]`,
        )
        ?.scrollIntoView({ block: 'center' }),
    )
  },
  // B430: a line of Activity opens what it is about in the pane beside the list, which stays
  'log-open': (d, e) => {
    if ((e?.target as Element | undefined)?.closest('button, a')) return // its codes and Undo do their own thing
    U.sideSel = d.key as string
    if (d.n) return openItem(N(d))
    if (d.d) return openDoc(Number(d.d))
    if (d.id) return ACT['go-input'](d)
  },
  // B430: a row of Deleted shows what it was beside the list, with Restore
  'gone-show': (d, e) => {
    if ((e?.target as Element | undefined)?.closest('button')) return
    U.sideSel = d.key as string
    if (U.open) closeItem()
    U.doc = null
    render()
  },
  'docs-go': (d) => {
    // T274 #18: from the list of documents, in the tab its item is in; Back comes back to the list
    const dn = Number(d.d),
      doc = docById(dn),
      it = doc ? byN.get(liveN(doc.n)) : undefined,
      t = it?.archived ? 'archive' : it?.type === 'rule' ? 'rules' : 'items'
    if (desk()) {
      D.page = null
      if (U.tab !== t && !U.side) setTab(t) // B435: from the Documents list, the list stays; the pane shows it
      else render()
    }
    openDoc(dn)
  },
  // F432: a web page's comment mode, and what it offers beside the part you point at or tap
  'doc-inspect': () => {
    U.docInspect = !U.docInspect
    renderDoc()
  },
  'page-pick': (d) => {
    U.docSel = new Set()
    U.docReply = null
    U.docQuote = { key: d.key as string, text: d.quote as string }
    if (!desk()) U.docType = true
    renderDoc()
    els.text?.focus({ preventScroll: true })
  },
  'page-say': (d, e) => {
    const r = ((e?.target as Element | undefined)?.closest('[data-act]') as HTMLElement | null)?.getBoundingClientRect()
    if (r) void pageSay(d.key as string, d.quote as string, r)
  },
  'doc-jump': (d) => {
    document
      .querySelector(`#docBlocks [data-key="${CSS.escape(d.key as string)}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  },
  'doc-new': (d) => newDoc(N(d)),
  'doc-edit': () => {
    const was = kept('docs')[`D${U.doc}`] as string | undefined
    U.docEdit = true
    U.docText = was ?? null
    renderDoc()
    if (was) toast('Your draft is back')
    requestAnimationFrame(() => document.getElementById('docMd')?.focus())
  },
  'doc-done': async () => {
    if (!(await docVoiceSettled())) return
    const d = await saveDoc()
    if (d) openDoc(d.d)
    else if (!U.docEdit) closeDialog()
  },
  'doc-mic': () => (DV.rec ? docRecStop() : docRecStart()),
  'needs-more': () => {
    U.needsAll = !U.needsAll
    bump('list')
  },
  'doc-discard': () => {
    const d = U.doc,
      key = U.doc ? `D${U.doc}` : `new ${U.docNew}`
    docRecStop(false)
    DV.notes.forEach((v) => {
      if (v.key === key) v.key = null
    })
    kept('docs', (all) => delete all[key])
    U.docEdit = false
    U.docText = null
    if (d && docById(d)) openDoc(d)
    else closeDialog()
  },
  'doc-pick': (d, e) => {
    const target = (e as Event | undefined)?.target as Element | undefined
    if (
      U.docCircle ||
      (target?.closest('textarea, button, a') && !target.closest('[data-pick-btn]')) ||
      getSelection()?.toString().trim()
    )
      return
    if (desk() && !d.pickBtn && !U.docSel.size) return // T274 #1: reading and copying never pick; Comment does
    const k = d.key as string
    const li = !desk() && !d.quote ? target?.closest('li') : null
    if (li) {
      // B9 (T422): on the phone a tap on one item of a list picks that item, as pointing at it does on the desktop
      const q = (li as HTMLElement).innerText.trim().slice(0, 500)
      if (U.docQuote?.key === k && U.docQuote.text === q) U.docQuote = null
      else {
        U.docSel = new Set()
        U.docQuote = { key: k, text: q }
      }
      U.docReply = null
      return renderDoc()
    }
    if (d.quote) {
      // B355: one item of a list: the comment quotes it
      U.docSel = new Set()
      U.docQuote = { key: k, text: d.quote as string }
      U.docReply = null
      renderDoc()
      if (desk()) els.text?.focus({ preventScroll: true })
      return
    }
    if (U.docSel.has(k)) U.docSel.delete(k)
    else if (!desk() && !U.docType) U.docSel = new Set([k])
    else U.docSel.add(k)
    U.docQuote = null
    U.docReply = null
    renderDoc()
    if (desk() && docTarget()) els.text?.focus({ preventScroll: true }) // A1
  },
  'doc-unpick': () => {
    if (!desk() && U.docType) {
      U.docType = false
      renderDoc()
      return
    }
    U.docSel = new Set()
    U.docQuote = null
    U.docReply = null
    U.docDrafts.note = ''
    getSelection()?.removeAllRanges()
    renderDoc()
  },
  'doc-close': () => closeDoc(),
  'doc-resolve': async (d) => {
    const dn = U.doc,
      key = d.key as string,
      on = d.on === '1'
    const put = (v: boolean) =>
      instant({ op: 'dcres', d: dn, key, on: v }, () => {
        const doc = docById(dn)
        if (!doc) return
        doc.resolved ||= {}
        if (v) doc.resolved[key] ||= new Date().toISOString()
        else delete doc.resolved[key]
      }) // R409: at once
    void put(on)
    if (!on) U.docThreads.add(key)
    else U.docThreads.delete(key)
    D.docKey = null
    render()
    toast(
      on ? 'Resolved' : 'Open again',
      pushUndo(on ? 'Resolve a thread' : 'Reopen a thread', () => put(!on)),
    )
  },
  'doc-say': (d) => docSay(d.key as string, d.quote as string | undefined),
  'doc-type': () => {
    U.docType = true
    renderDoc()
    els.text?.focus()
  },
  'doc-say-cancel': async () => {
    await cancelRec()
    renderDoc()
  },
  'doc-whole': () => {
    Object.assign(U, { docSel: new Set(), docQuote: null, docReply: null, docType: true })
    renderDoc()
    els.text?.focus()
  },
  'doc-comment-sel': () => {
    els.text?.focus({ preventScroll: true })
  },
  vc: () => vcToggle(),
  'vc-fix': () => {
    // F204: the words you selected in a voice note get corrected in the box, and remembered
    const c = U.fixCand
    if (!c) return
    U.correct = c
    U.amend = null
    U.correctSel = true
    U.fixCand = null
    render()
    els.text?.focus()
  },
  'doc-to-item': () => {
    const doc = docById(U.doc),
      n = doc ? liveN(doc.n) : null
    if (desk()) closeDoc()
    else {
      if (n && byN.has(n) && U.open !== n) openItem(n)
      closeDialog()
    }
    els.text?.focus({ preventScroll: true })
  },
  'doc-reply': (d) => {
    U.docReply = d.key || null
    U.docSel = new Set()
    U.docQuote = null
    renderDoc()
    els.text?.focus()
  },
  'doc-circle': () => {
    U.docCircle = !U.docCircle
    renderDoc()
  },
  'dc-edit': (d) => editComment(Number(d.d), Number(d.id)),
  'doc-tick': (d) => {
    // F393, B412: a choice in a document is ticked on the page at once and waits; the box below sends them all
    if (!tickDoc(Number(d.d), d.key as string, Number(d.i)))
      return toast('Could not tick it: the document changed. Open it again', null, { error: true })
    if (!desk()) U.docType = true // the phone: the box comes under the document, with Send
    renderDoc()
    bump('composer')
  },
  'doc-tick-edit': (d) => {
    // F428: Modify on a sent form: it is a form again, to change and send again
    tickModify(Number(d.d), d.key as string)
    renderDoc()
  },
  'doc-ticks-clear': () => {
    const doc = docOpen()
    if (doc) clearTicks(doc.d)
    renderDoc()
    bump('composer')
  },
  'dc-delete': (d) => deleteComment(Number(d.d), Number(d.id)),
  'doc-thread': (d) => {
    const k = d.key as string
    if (U.docThreads.has(k)) U.docThreads.delete(k)
    else U.docThreads.add(k)
    renderDoc()
  },
  swipe: (d) => {
    const n = N(d),
      f = d.f as string
    closeDialog()
    change(n, f, f === 'archived' ? d.v === 'true' : d.v)
  },
  archive: (d) => {
    // E: with Undo and Z (T113 A7)
    const on = d.on === '1',
      n = N(d)
    closeDialog()
    change(n, 'archived', on, { note: on ? 'Find it under Archive' : '' })
    if (on && U.open === n) ACT.back({})
  },
  choice: (d) => {
    const n = N(d),
      i = Number(d.i)
    if (U.choice?.n !== n) U.choice = { n, picked: new Set() }
    const p = U.choice.picked
    if (d.multi) {
      if (p.has(i)) p.delete(i)
      else p.add(i)
    } else {
      p.clear()
      p.add(i)
    }
    keepChoice()
    bump('detail', 'dialog', 'composer')
  },
  'choice-send': (d) => sendChoice(N(d)),
  // F428 (P0): an answered question becomes a form again, your last picks ticked, to change and send again
  'ask-modify': (d) => {
    const n = N(d),
      x = byN.get(n)?.thread.find((m) => m.id === Number(d.id)),
      th = byN.get(n)?.thread || []
    if (!x) return
    const done = answerOf(th, x) || [],
      labels = x.text.split('\n').flatMap((l) => (CHOICE.test(l) ? [l.replace(CHOICE, '').trim()] : []))
    U.reask = x.id
    U.choice = { n, picked: new Set(labels.flatMap((l, i) => (done.includes(l) ? [i] : []))) }
    render()
  },
  // F428 (P0): a decided proposal or finished work goes back to its choice, to choose again
  'decided-modify': (d) => {
    const n = N(d),
      dec = U.decided.get(n)
    if (!dec) return
    U.decided.delete(n)
    change(n, 'status', dec.from, { said: 'is back for you to decide' })
  },
  'ask-modify-cancel': () => {
    U.reask = null
    U.choice = null
    render()
  },
  'more-msg': (d) => {
    const id = Number(d.id)
    if (U.moreMsgs.has(id)) U.moreMsgs.delete(id)
    else U.moreMsgs.add(id)
    bump('detail', 'dialog')
  },
  fold: (d) => {
    const n = N(d)
    if (U.folded.has(n)) U.folded.delete(n)
    else U.folded.add(n)
    bump('list')
  },
  'sub-new': (d) => {
    closeDialog()
    const n = (U.subFor = N(d))
    render()
    const f = document.getElementById('subTitle') as HTMLInputElement | null,
      was = kept('subs')[n] as string | undefined
    if (f && was) {
      f.value = was
      toast('Your subitem title is back')
    }
    f?.focus()
    if (f) fieldInSight(f)
  },
  'sub-cancel': () => {
    const n = U.subFor
    kept('subs', (all) => {
      if (n != null) delete all[n]
    })
    U.subFor = null
    bump('detail')
  },
  'sub-add': (d) => {
    // same kind, priority and now/later as the parent; change them after if needed. T424: it shows under its parent at
    // once (its code "…" until Taska gives it a number) and the field is ready for the next one
    const n = N(d),
      p = byN.get(n),
      f = document.getElementById('subTitle') as HTMLInputElement | null,
      title = (f?.value || '').trim()
    if (!title || !p) return f?.focus()
    const tmp = standN(),
      type = p.type === 'rule' ? 'task' : p.type
    const stand = {
      ...p,
      n: tmp,
      code: '…',
      type,
      title,
      body: '',
      status: 'open',
      parent: n,
      next: '',
      thread: [],
      srcs: [],
      wait: null,
      reply: false,
      archived: false,
      rank: null,
      t0: new Date().toISOString(),
      t1: new Date().toISOString(),
      agent: undefined,
      read: undefined,
      by: 'you',
    } as Item
    void optimistic(
      [
        {
          temp: true,
          fn: () => {
            if (byN.has(tmp)) return
            model.S.items = [...model.S.items, stand]
            byN.set(tmp, stand)
          },
        },
      ],
      { op: 'new', title, parent: code(n), type, pri: p.pri, when: p.when },
      (ex) => {
        notSaved(ex, () => ACT['sub-add'](d), `adding “${title}” under ${code(n)}`)
        const g = document.getElementById('subTitle') as HTMLInputElement | null
        if (g && !g.value.trim()) g.value = title // what you wrote is not lost
      },
    )
    kept('subs', (all) => delete all[n])
    U.folded.delete(n)
    render()
    if (f) {
      f.value = ''
      f.focus()
      fieldInSight(f)
    } // the field stays for the next one (B123)
  },
  'move-to': (d) => {
    const n = N(d),
      to = d.to as string
    closeDialog()
    change(n, 'parent', to === 'none' ? null : parseRef(to))
  },
  reparent: (d) => {
    if (desk()) closeDialog()
    movePicker(N(d))
  },
  'make-item': async (d) => {
    // no organizer and no agent around: turn the input into an item yourself
    const r = byR.get(d.id as string)
    if (!r) return
    const lines = r.text.trim().split('\n'),
      first = lines[0].trim()
    const title = shortTitle(first) || `Files from ${rcode(r.id)}`,
      body = title !== first ? r.text.trim() : lines.slice(1).join('\n').trim() // T113 A25
    try {
      const a = await save({ op: 'new', title, body, src: r.id }, () => ACT['make-item'](d))
      const n = Number((a.res[0].match(/[A-Z](\d+) new/) || [])[1])
      if (!n) return
      const run = pushUndo(`${code(n)} made from ${rcode(r.id)}`, () => {
        toast(`${code(n)} undone: ${rcode(r.id)} waits again`)
        return optimistic(
          [{ n, f: { status: 'dropped', archived: true } }],
          () => op({ op: 'unmake', ref: code(n) }),
          (ex) => notSaved(ex, run),
        )
      })
      toast(`${code(n)} made from ${rcode(r.id)}: set its type and priority`, run)
      if (!desk()) return itemMenu(n)
      const chip = [
          ...document.querySelectorAll<HTMLElement>(
            `:is(#inputsView, #composeList, #detailBody) [data-act="goto"][data-n="${n}"]`,
          ),
        ].find((el) => el.offsetParent),
        at = chip?.getBoundingClientRect()
      itemMenuDesk(n, 't')
      if (at) popAt(at.left, at.bottom + 6)
    } catch {
      /* save said why */
    }
  },
  'archive-all': () => {
    // r6: every finished item in this view goes to Archive at once; Undo in the toast for 10 seconds, then Z (B154)
    const ids = visible()
      .filter((it) => !it.archived && CLOSED(it.status))
      .map((it) => it.n)
    if (!ids.length) return
    const put = (on: boolean) =>
      optimistic(
        ids.map((n) => ({ n, f: { archived: on } })),
        async () => {
          const left = ((await op({ op: 'archive', refs: ids.map(code), on })).res[0].match(/not archived: (.+)$/) ||
            [])[1] // one change, however many (T113 A5)
          if (left)
            toast(
              `${left.split(' ').length === 1 ? `${left} isn't` : `${left.split(' ').join(', ')} aren't`} finished any more, so ${left.split(' ').length === 1 ? 'it stays' : 'they stay'}`,
            )
        },
      )
    void put(true)
    toast(
      `Archived ${plural(ids.length, 'item')}`,
      () => {
        toast(`Put back ${plural(ids.length, 'item')}`)
        return put(false)
      },
      { ms: 10000 },
    )
  },
  'search-in': (d) => {
    U.tabView[d.tab as string] = { q: U.q }
    setTab(d.tab as never)
  },
  'copy-text': (d) => copy(d.text || ''),
  sources: (d) => openDialog('sources', { n: N(d) }),
  close: () => closeDialog(),
  attach: () => document.getElementById('fileInput')?.click(),
  mic: (d) => {
    R.from = d.aux ? 'aux' : 'main'
    return void startRec()
  },
  'rec-stop': () => {
    void finishRec(false)
  },
  'rec-send': () => {
    void finishRec(true)
  },
  'rec-cancel': () => {
    void cancelRec()
  },
  unfile: (d) => {
    // B149: removing a voice note also removes the words it put in the box; both come back with Undo
    const i = Number(d.i),
      f = U.files[i],
      t = els.text
    if (!f || !t) return
    const before = t.value
    U.files.splice(i, 1)
    if (f.rid) {
      f.gone = true
      dropRec(f, false)
    }
    if (f.trAdded && t.value.includes(f.trAdded)) {
      t.value = t.value
        .replace(f.trAdded, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      saveDraft()
      toast('Removed the voice note and its words', () => {
        U.files.splice(i, 0, f)
        t.value = before
        saveDraft()
        bump('composer')
        if (f.rid) {
          f.gone = false
          holdRec(f)
          void keepRec(f)
          if (f.transcribing) hear(f)
        }
      })
    }
    bump('composer')
  },
  'doubt-use': (d) => {
    const f = U.files[Number(d.i)],
      x = f?.doubts?.[Number(d.k)]
    if (!x || !doubtPick(f, x, 'alt')) return
    toast(`Changed to “${(x.show || [])[1] || x.alt}”`, () => {
      doubtPick(f, x, 'was')
      delete x.pick
      void keepRec(f)
      bump('composer')
    })
  },
  'doubt-pick': (d) => {
    const f = U.files[Number(d.i)],
      x = f?.doubts?.[Number(d.k)]
    if (x) doubtPick(f, x, d.side as 'was' | 'alt')
  },
  'box-view': () => {
    U.boxView = true
    bump('composer')
  },
  'view-draft': (d) => {
    const f = U.files[Number(d.i)]
    if (!f?.f) return
    openViewer(
      U.files.filter((x) => x.f && (x.mime || '').startsWith('image/')).map((x) => x.f as string),
      f.f,
    )
  },
  unscope: () =>
    carry(() => {
      U.scopeOff = true
      bump('composer')
      els.text?.focus()
    }),
  send: () => send(),
  dismiss: () => {
    U.lastSent = null
    U.note = null
    bump('feedback')
  },
  undo: async (d) => {
    // Undo organizing (T113 A4): what the organizer did with an input, as it left it
    const id = d.id as string,
      what = byR.get(id)?.filing?.what
    let r: { ok: boolean; error?: string }
    try {
      r = await net(ctx.P + 'api/undo', JSON_POST({ id }), NET.op)
    } catch (ex) {
      return notSaved(ex, () => ACT.undo(d))
    }
    if (!r.ok) return toast(r.error || 'Could not undo', null, { error: true })
    if (U.lastSent === id) U.lastSent = null
    try {
      await load()
    } catch {
      /* the next poll */
    }
    const run = pushUndo(`Filing of ${rcode(id)} undone`, async () => {
      let q: { ok: boolean; error?: string }
      try {
        q = await net(ctx.P + 'api/redo', JSON_POST({ id }), NET.op)
      } catch (ex) {
        notSaved(ex, run)
        return false
      }
      if (!q.ok) {
        toast(q.error || 'Could not put it back', null, { error: true })
        return false
      }
      try {
        await load()
      } catch {
        /* the next poll */
      }
      toast(`The filing of ${rcode(id)} is back`)
    })
    toast(`Undid the filing of ${rcode(id)}${what ? `: ${what}` : ''}`, run)
  },
  'move-input': (d) => openDialog('move-input', { id: d.id }),
  'input-more': (d) => inputMenu(d.id as string),
  'item-delete': (d) => {
    // T257 #5: with its subitems, to Deleted; Undo or Restore brings them back. R409: gone at once
    const n = N(d),
      ref = code(n)
    if (!confirmClick('item-delete ' + n)) return
    closeDialog()
    const ids = new Set<number>()
    for (let k = [n]; k.length; k = k.flatMap((x) => (kids.get(x) || []).map((it) => it.n)))
      k.forEach((x) => ids.add(x))
    const snap = model.S.items.filter((it) => ids.has(it.n))
    void instant({ op: 'idel', ref }, () => {
      model.S.items = model.S.items.filter((it) => !ids.has(it.n))
      for (const x of ids) byN.delete(x)
    })
    if (U.open === n) {
      if (desk()) {
        U.open = null
        render()
      } else closeItem()
    }
    toast(
      `Deleted ${ref}`,
      pushUndo(`${ref} deleted`, async () => {
        const ok = await instant({ op: 'iundel', ref }, () => {
          for (const it of snap)
            if (!byN.has(it.n)) {
              model.S.items.push(it)
              byN.set(it.n, it)
            }
        })
        if (ok) toast(`${ref} is back`)
      }),
    )
  },
  'item-move-proj': (d) => {
    const n = N(d)
    if (!otherProjects().length) return toast('There is no other project to move it to')
    openDialog('item-move-proj', { n }, { focus: false })
  },
  'item-move-to': (d) => {
    // F397: it leaves this project at once (with its subitems) and Taska is told behind you, sent again while it
    // can't be reached; it comes back, with why, only when the move finally can't be done
    const n = N(d),
      ref = code(n),
      to = d.to as string,
      tree: number[] = []
    for (let k = [n]; k.length; k = k.flatMap((x) => (kids.get(x) || []).map((it) => it.n))) tree.push(...k)
    closeDialog()
    const got = { as: '', with: 0 }
    const done = optimistic(
      tree.map((k) => ({ n: k, f: { status: 'dropped', archived: true } })),
      async () => {
        const r = await postAgain<{ ok: boolean; as: string; with?: number; error?: string }>(ctx.P + 'api/move-item', {
          ref,
          to,
        })
        if (!r.ok) throw new Error(r.error)
        Object.assign(got, { as: r.as, with: r.with || 0 })
        carryDraft(ref, to, r.as) // B408: what you wrote in its box goes along
        await load()
      },
      (ex) =>
        addFailed(
          `moving ${ref} to ${projName(to)} (it is back here)`,
          (ex as { net?: boolean }).net ? 'Taska was out of reach' : (ex as Error).message || 'Taska said no',
          () => ACT['item-move-to'](d),
        ),
    )
    toast(
      `Moved ${ref} to ${projName(to)}` + (tree.length > 1 ? ` with its ${plural(tree.length - 1, 'subitem')}` : ''), // B336
      async () => {
        if (await done) navigate(`/p/${encodeURIComponent(to)}/${got.as}`)
      },
      { label: 'Open' },
    )
  },
  'rescope-pick': (d) => {
    closeDialog()
    const r = byR.get(d.id as string)
    itemPicker(`Put ${rcode(d.id)} with…`, 'rescope-to', { id: d.id }, r?.scope ? [r.scope] : [])
  },
  'rescope-to': (d) => {
    // R409: at once
    const id = d.id as string,
      was = byR.get(id)?.scope,
      to = d.to as string
    closeDialog()
    const put = (ref: string) =>
      instant({ op: 'rescope', id, to: ref }, () => {
        const r = byR.get(id)
        if (r) r.scope = parseRef(ref)
      })
    void put(to)
    toast(
      `${rcode(id)} now goes with ${to}`,
      was
        ? pushUndo(`${rcode(id)} moved`, async () => {
            if (await put(code(was))) toast(`${rcode(id)} is back with ${code(was)}`)
          })
        : null,
    )
  },
  'doc-delete': () => {
    // R409: gone at once
    const dn = U.doc
    if (!dn || !confirmClick('doc-delete ' + dn)) return
    const doc = docById(dn),
      host = doc ? liveN(doc.n) : null
    void instant({ op: 'ddel', d: dn }, () => {
      model.S.docs = (model.S.docs || []).filter((x) => x.d !== dn)
    })
    closeDoc()
    if (!desk()) closeDialog()
    toast(
      `Deleted D${dn}`,
      pushUndo(`D${dn} deleted`, async () => {
        const ok = await instant({ op: 'ddel', d: dn, on: false }, () => {
          if (doc && !docById(dn)) model.S.docs = [...(model.S.docs || []), doc]
        })
        if (ok) toast(`D${dn} is back`)
      }),
    )
    if (host && byN.has(host) && desk()) openItem(host)
  },
  'doc-move': () => {
    const doc = docById(U.doc)
    if (doc) itemPicker(`Put D${doc.d} on…`, 'doc-move-to', { d: String(doc.d) }, [liveN(doc.n)])
  },
  'doc-move-to': (d) => {
    // R409: at once
    const dn = Number(d.d),
      was = docById(dn)?.n,
      to = d.to as string
    closeDialog()
    const put = (ref: string) =>
      instant({ op: 'dmove', d: dn, to: ref }, () => {
        const doc = docById(dn),
          n = parseRef(ref)
        if (doc && n) doc.n = n
      })
    void put(to)
    openDoc(dn)
    toast(
      `D${dn} is now on ${to}`,
      pushUndo(`D${dn} moved`, async () => {
        if (await put(code(was))) toast(`D${dn} is back on ${code(was)}`)
      }),
    )
  },
  'dc-move': (d) => {
    const doc = docById(Number(d.d)),
      c = dcFind(Number(d.d), Number(d.id))
    if (!doc || !c) return
    openDialog('dc-move', { d: doc.d, id: c.id }, { focus: false })
  },
  'dc-move-to': async (d) => {
    const dn = Number(d.d),
      id = Number(d.id),
      was = dcFind(dn, id)?.key,
      key = d.key as string
    closeDialog()
    if (key === was) return
    try {
      await save({ op: 'dcmove', d: dn, id, key })
    } catch {
      return
    }
    U.docThreads.add(key)
    D.docKey = null
    render()
    toast(
      'Comment moved',
      pushUndo('Move a comment', async () => {
        await save({ op: 'dcmove', d: dn, id, key: was })
        render()
      }),
    )
  },
  'sent-unfile': (d) => {
    // T257 #11: one file taken off what you sent. R409: at once
    if (!confirmClick(`unfile ${d.d || ''} ${d.id} ${d.f}`)) return
    closeDialog()
    void instant(
      d.d ? { op: 'unfile', d: Number(d.d), id: Number(d.id), f: d.f } : { op: 'unfile', id: d.id, f: d.f },
      () => {
        const c = d.d ? dcFind(Number(d.d), Number(d.id)) : byR.get(d.id as string)
        if (c?.files) c.files = c.files.filter((x) => x.f !== d.f)
      },
      'taking a file off',
    )
    D.docKey = null
    render()
    toast('File taken off')
  },
  'sign-in': async () => {
    const el = document.getElementById('signKey') as HTMLInputElement | null
    try {
      await signIn(el?.value || '')
      closeDialog()
      toast('Signed in')
      void refresh()
    } catch (ex) {
      toast((ex as Error).message, null, { error: true })
      el?.select()
    }
  },
  // F320: your own views of the list
  'view-use': (d) => {
    if (U.tab === 'archive') setTab('items') // F348: the archive is a view; yours show items
    showView(Number(d.i))
  },
  'view-save': () => {
    const el = document.getElementById('viewName') as HTMLInputElement | null
    saveView(el?.value || '')
    if (el) el.value = ''
  },
  'view-rename': (d) => {
    closeDialog()
    VW_STATE.edit = Number(d.i)
    bump('list')
  },
  'view-update': (d) => {
    closeDialog()
    updateView(Number(d.i))
  },
  'view-delete': (d) => {
    closeDialog()
    deleteView(Number(d.i))
  },
  'msg-menu': (d) => openDialog('msg-menu', { n: N(d), id: Number(d.id) }, { pop: true, focus: false }), // B321: Hide is in ⋯
  'msg-hide': (d) => {
    // T257 #12; R409: at once
    closeDialog()
    const on = d.on === '1',
      n = N(d),
      ref = code(n),
      id = Number(d.id)
    const put = (v: boolean) =>
      instant({ op: 'hide', ref, id, on: v }, () => {
        const x = byN.get(n)?.thread.find((m) => m.id === id)
        if (x) x.hidden = v
      })
    void put(on)
    U.showHidden.delete(id)
    toast(
      on ? 'Message hidden' : 'Message shown',
      pushUndo(on ? 'Hide a message' : 'Show a message', () => put(!on)),
    )
  },
  'msg-peek': (d) => {
    U.showHidden.add(Number(d.id))
    bump('detail')
  },
  'gone-restore': async (d) => {
    if (restoredJustNow()) return
    try {
      await save(d.kind === 'item' ? { op: 'iundel', ref: d.ref } : { op: 'ddel', d: Number(d.d), on: false })
    } catch {
      return
    }
    toast(`${d.label} is back`)
    bump('project')
  },
  'input-pick': (d) => {
    closeDialog()
    ACT[d.pick as string]?.({ id: d.id })
  },
  'input-edit': (d) => editInput(d.id as string, 'edit'),
  'input-append': (d) => editInput(d.id as string, 'append'),
  'input-history': (d) => openDialog('history', { id: d.id }),
  'amend-cancel': () => {
    U.amend = null
    render()
  },
  'prefs-edit': () => editPrefs(),
  'prefs-cancel': () => cancelPrefs(),
  'correct-cancel': () => {
    U.correct = null
    getSelection()?.removeAllRanges()
    render()
  },
  fixes: () => openProject('fixes'),
  'tidy-toggle': async () => {
    try {
      const r = await net<{ tidy: boolean }>('/api/voicetidy', JSON_POST({ on: !P_CACHE.prefs?.tidy }), NET.op)
      if (P_CACHE.prefs) P_CACHE.prefs.tidy = r.tidy
      bump('project', 'detail', 'inputs')
      toast(r.tidy ? 'Voice notes are tidied' : 'Voice notes are kept word for word')
    } catch (ex) {
      notSaved(ex)
    }
  },
  'as-said': async (d, e) => {
    const at = ((e as Event | undefined)?.target as Element | undefined)?.closest('[data-act]')?.getBoundingClientRect()
    const url = `${ctx.P}api/transcript?f=${encodeURIComponent(d.f as string)}`
    try {
      // B363: the words kept with the note come at once; only a note never written down waits for its words (a POST
      // after a restart wrote it down again, which took seconds)
      const r = await net<{ heard?: string; tr?: string }>(url).catch(() =>
        net<{ heard?: string; tr?: string }>(url, { method: 'POST' }),
      )
      // F364: on the desktop the words as said float beside the note, not a sheet over the page
      openDialog('as-said', { heard: r.heard || '', tr: r.tr || '' }, desk() ? { pop: true, focus: false } : undefined)
      if (at && desk()) popAt(at.left, at.bottom + 6)
    } catch {
      notLoaded('the words as said', () => ACT['as-said'](d))
    }
  },
  'fix-add': async (d) => {
    const right = (d.right ?? fieldValue('fixWord')).trim()
    if (!right) return document.getElementById('fixWord')?.focus()
    try {
      await setFix({ right })
      toast(`Voice notes will hear “${right}”`)
      // C14 (T422): the field is ready for the next word, and the one added is in sight
      const f = document.getElementById('fixWord') as HTMLInputElement | null
      if (f && !d.right) f.value = ''
      setTimeout(
        () =>
          [...document.querySelectorAll<HTMLElement>('[data-act="fix-remove"]')]
            .find((b) => b.dataset.right === right)
            ?.scrollIntoView({ block: 'center' }),
        80,
      ) // after the list is drawn again
    } catch {
      /* setFix said why */
    }
  },
  'fix-remove': async (d) => {
    if (!d.wrong) {
      const right = d.right as string
      try {
        await setFix({ right, forget: true })
        toast(`Forgot “${right}”`, () => setFix({ right }).catch((ex) => notSaved(ex)))
      } catch (ex) {
        notSaved(ex, () => ACT['fix-remove'](d))
      }
      return
    }
    const wrong = d.wrong,
      c = (P_CACHE.fixes || []).find((x) => x.wrong === wrong)
    try {
      await setFix({ wrong })
      toast(`Forgot “${wrong}”`, () => setFix({ wrong, right: c?.right }).catch((ex) => notSaved(ex)))
    } catch (ex) {
      notSaved(ex, () => ACT['fix-remove'](d))
    }
  },
  'undo-mine': () => undoMine(),
  unsend: (d) => [...U.outbox, ...U.sentJobs].find((j) => j.q === d.q)?.undo?.(),
  revert: (d) => {
    if (!confirmClick('revert ' + d.seq)) return // B127: an older change goes back only on a second click
    return revertNow(Number(d.seq))
  },
  'outbox-retry': () => {
    for (const q of U.outbox) q.failed = false
    bump('feedback')
    flushOutbox()
  },
  'outbox-edit': () => {
    // the unsent input back in the box, as long as the box is empty
    const q = U.outbox[0],
      t = els.text
    if (!q || !t) return
    if (t.value.trim() || U.files.length) return toast('Send or clear what is in the box first')
    U.outbox.shift()
    try {
      const key = 'taska.outbox.' + model.S.project,
        all = JSON.parse(localStorage.getItem(key) || '{}')
      delete all[q.q]
      localStorage.setItem(key, JSON.stringify(all))
    } catch {
      /* no storage */
    }
    t.value = q.text
    U.files = q.files
    saveDraft()
    render()
    t.focus()
    for (const f of q.files)
      if (f.rid) {
        f.job = null
        f.key = U.draftKey
        void keepRec(f)
      } // T101: kept as a draft in this box again
  },
  'move-input-to': async (d) => {
    const id = d.id as string,
      to = d.to as string
    try {
      const r = await net<{ ok: boolean; as: string; error?: string }>(
        ctx.P + 'api/move',
        JSON_POST({ id, to }),
        NET.op,
      )
      if (!r.ok) return toast(r.error || 'Could not move it', null, { error: true })
      closeDialog()
      if (U.lastSent === id) U.lastSent = null
      try {
        await load()
      } catch {
        /* the next poll */
      }
      toast(
        `Moved ${rcode(id)} to ${projName(to)} as ${rcode(r.as)}`,
        () => navigate(`/p/${encodeURIComponent(to)}/`),
        { label: 'Open' },
      )
    } catch (ex) {
      notSaved(ex, () => ACT['move-input-to'](d))
    }
  },
  retry: async (d) => {
    try {
      await net(ctx.P + 'api/organize', JSON_POST({ id: d.id }), NET.op)
      U.lastSent = d.id || null
    } catch (ex) {
      notSaved(ex, () => ACT.retry(d))
    }
  },
  view: (d) => {
    openViewer(groups.get(d.g || '') || [d.f as string], d.f as string)
  },
  'v-close': () => viewerAct('close'),
  'v-prev': () => viewerAct('prev'),
  'v-next': () => viewerAct('next'),
  'v-zoom': () => viewerAct('zoom'),
  play: (d) => playAudio(d.src as string),
}
export function needsYouN(n: number) {
  const it = byN.get(n)
  return (
    !!it &&
    !it.merged_into &&
    !CLOSED(it.status) &&
    (!!it.wait || ((it.status === 'proposed' || it.status === 'review') && !it.reply))
  )
}
export function act(name: string, data: Data = {}, e?: KeyLike) {
  const h = ACT[name]
  if (!h) return
  return h(data, e)
}
export function openDrawer() {
  if (!DR.open) layerOpen('drawer')
  DR.open = true
  bump('side', 'view', 'toast')
  fillDrawer()
}
export function closeDrawerNow() {
  closeDrawer()
}
// T274 #34: pick several rows with Cmd-click (one more) or Shift-click (all from the last one)
export function pickRow(n: number, range: boolean) {
  const rows = [...document.querySelectorAll<HTMLElement>('#list [data-act="open"][data-n]')].map((el) =>
    Number(el.dataset.n),
  )
  if (!U.sel.size && U.open && rows.includes(U.open)) {
    U.sel.add(U.open)
    U.selFrom = U.open
  }
  const a = rows.indexOf(U.selFrom ?? -1),
    b = rows.indexOf(n)
  if (range && a >= 0 && b >= 0) for (const k of rows.slice(Math.min(a, b), Math.max(a, b) + 1)) U.sel.add(k)
  else if (U.sel.has(n)) U.sel.delete(n)
  else U.sel.add(n)
  U.selFrom = n
  bump('list')
}
export function batchSet(f: string, v: unknown, said: string) {
  const ns = [...U.sel].filter((n) => byN.get(n) && (byN.get(n) as unknown as Record<string, unknown>)[f] !== v)
  U.sel.clear()
  U.selFrom = null
  if (!ns.length) {
    bump('list')
    return toast('Nothing to change')
  }
  const before = new Map(ns.map((n) => [n, (byN.get(n) as unknown as Record<string, unknown>)[f]]))
  const wire = (x: unknown) => (f === 'parent' ? (x ? String(x) : 'none') : x)
  const set = (to: (n: number) => unknown) =>
    optimistic(
      ns.map((n) => ({ n, f: { [f]: to(n) } })),
      () => Promise.all(ns.map((n) => op({ op: 'set', ref: code(n), f: { [f]: wire(to(n)) } }))),
      (ex) => notSaved(ex, run),
    )
  const run = pushUndo(`${plural(ns.length, 'item')} ${said}`, () => {
    toast(`Put back ${plural(ns.length, 'item')}`)
    return set((n) => before.get(n))
  })
  toast(`${plural(ns.length, 'item')} ${said}`, run)
  set(() => v)
}

// F407: every action is logged, with how it came (a click, a key, a drop, the page)
for (const [k, fn] of Object.entries(ACT))
  ACT[k] = (d, e) => {
    actLog(k, d)
    return fn(d, e)
  }
