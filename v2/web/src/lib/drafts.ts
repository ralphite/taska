// A draft belongs to what it is written to (B118): an item (a reply), one of its documents (a comment, B298), or a new
// input (a new rule too). Each project keeps them by target in this browser; when the box changes target, the words
// and files stay with the old target and the new target's own draft comes back. So unsent words never go elsewhere.
// Every tab of this browser shows the same drafts (T113 A10, B11, B24).
import {
  OV,
  R_STATE,
  U,
  bump,
  byN,
  byR,
  code,
  ctx,
  dcFind,
  desk,
  docById,
  docOpen,
  els,
  inTab,
  liveN,
  model,
  parseRef,
  render,
  scopeN,
  tabOf,
  type DraftFile,
} from './state'
import { draftLog } from './actlog'
import { toast } from './toast'
import { keepRec, moveRecs } from './voice'
import { ACT } from './actions'
import { openItem, openProject, setTab } from './nav'
import { editComment, openDoc } from './docs'

export const draftKey = (): string => {
  if (U.prefsEdit) return 'prefs'
  if (U.correct) return `correct ${U.correct.id}`
  if (U.amend) return `${U.amend.mode} ${U.amend.id}`
  const od = docOpen(),
    n = scopeN()
  return od ? `doc ${od.d}` : n ? code(n) : 'new' // B10, B298
}
export function draftStore(change?: (all: Record<string, string>) => void): Record<string, string> {
  const key = 'taska.drafts.' + model.S.project
  try {
    const all = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>
    if (U.oldDraft) {
      all.new = all.new || U.oldDraft
      U.oldDraft = ''
      change ||= () => {}
    } // the one draft from before goes to New input
    if (all.rule) {
      all.new = [all.new, all.rule].filter((x) => x?.trim()).join('\n\n')
      delete all.rule
      change ||= () => {}
    } // B406: there is no New rule box any more: what was written there is New input's now
    if (change) {
      change(all)
      localStorage.setItem(key, JSON.stringify(all))
    }
    return all
  } catch {
    return {}
  }
}
export function keepChoice() {
  const c = U.choice,
    labels = (c && U.choiceLabels[c.n]) || []
  try {
    if (c?.picked.size)
      localStorage.setItem(
        'taska.choice.' + model.S.project,
        JSON.stringify({ n: c.n, picked: [...c.picked].map((i) => labels[i]).filter(Boolean) }),
      )
    else localStorage.removeItem('taska.choice.' + model.S.project)
  } catch {
    /* no storage */
  }
}
/** B408: what you wrote in an item's box goes with it to another project, into the box of what it is there (as). */
export function carryDraft(from: string, project: string, as: string) {
  if (U.draftKey === from) saveDraft()
  const text = String(draftStore()[from] || '')
  if (text.trim())
    try {
      const k = 'taska.drafts.' + project,
        all = JSON.parse(localStorage.getItem(k) || '{}') as Record<string, string>
      all[as] = [all[as], text].filter((x) => x?.trim()).join('\n\n')
      localStorage.setItem(k, JSON.stringify(all))
    } catch {
      return // no storage: it stays here
    }
  draftStore((all) => {
    delete all[from]
  })
  if (U.draftKey === from && els.text) els.text.value = ''
  void moveRecs(from, project, as)
}
export function saveDraft() {
  const k = U.draftKey,
    v = els.text?.value ?? ''
  if (k) draftLog(k, v)
  if (k)
    draftStore((all) => {
      if (v.trim()) all[k] = v
      else delete all[k]
    })
  draftMarks()
}
const DRAFTS = { raw: {} as Record<string, string | null>, val: {} as Record<string, Record<string, string>>, sig: '' }
export function draftsOf(slug: string): Record<string, string> {
  // -> {key: text} of any project, read again only when it changed
  let raw: string | null = null
  try {
    raw = localStorage.getItem('taska.drafts.' + slug)
  } catch {
    /* no storage */
  }
  if (DRAFTS.raw[slug] !== raw || !DRAFTS.val[slug]) {
    DRAFTS.raw[slug] = raw
    try {
      DRAFTS.val[slug] = JSON.parse(raw || '{}') || {}
    } catch {
      DRAFTS.val[slug] = {}
    }
  }
  return DRAFTS.val[slug]
}
export const hasDraft = (c: string, d: Record<string, string> = draftsOf(model.S.project)) =>
  c === U.draftKey
    ? !!((els.text?.value ?? '').trim() || U.files.length)
    : !!(String(d[c] || '').trim() || U.parked[c]?.length)
export function draftCodes() {
  // -> the items of this project with an unsent draft (words in any tab, or files in this one)
  const d = draftsOf(model.S.project),
    out = new Set<string>()
  for (const k of [...Object.keys(d), ...Object.keys(U.parked), U.draftKey || '']) {
    const dm = /^doc (\d+)$/.exec(k || ''),
      doc = dm && docById(Number(dm[1]))
    if ((doc || /^[A-Z]\d+$/.test(k || '')) && hasDraft(k, d)) out.add(doc ? code(liveN(doc.n)) : k) // B298
  }
  return out
}
export const projDraft = (slug: string) =>
  Object.values(draftsOf(slug)).some((v) => String(v || '').trim()) ||
  (slug === model.S.project &&
    !!(U.files.length || (els.text?.value ?? '').trim() || Object.values(U.parked).some((f) => f.length)))
export function draftMarks() {
  // a draft started or went: the rows and the sidebar say so
  if (!model.S.project) return
  const sig = [model.S.project, ...draftCodes()].join(' ')
  if (sig === DRAFTS.sig) return
  DRAFTS.sig = sig
  bump('list', 'side')
}
export function markSent(key: string | null) {
  // the other tabs: this draft went out from here
  try {
    if (model.S.project && key)
      localStorage.setItem('taska.sent.' + model.S.project, JSON.stringify({ k: key, t: Date.now() }))
  } catch {
    /* no storage */
  }
}
export function onStorage(e: StorageEvent) {
  if (!model.S.project || !e.key) return
  if (e.key === 'taska.sent.' + model.S.project) {
    let x: { k: string; t: number } | null = null
    try {
      x = JSON.parse(e.newValue || 'null')
    } catch {
      /* not ours */
    }
    if (
      x &&
      x.k === U.draftKey &&
      ((els.text?.value ?? '').trim() || (U.boxGone?.k === x.k && Date.now() - U.boxGone.t < 3000))
    )
      toast(
        `${/^[A-Z]\d+$/.test(x.k) ? `Your reply to ${x.k}` : x.k === 'new' ? 'Your new input' : 'What you wrote'} was sent from another tab`,
      )
    return
  }
  if (e.key === 'taska.drafts.' + model.S.project && U.draftKey && !R_STATE.rec) {
    const t = els.text
    if (!t) return
    const was = t.value,
      now = String(draftsOf(model.S.project)[U.draftKey] || '')
    if (now !== was && now.trim() !== was.trim()) {
      const [s, en] = [t.selectionStart, t.selectionEnd]
      t.value = now
      if (now.startsWith(was)) {
        t.selectionStart = s
        t.selectionEnd = en
      } else t.selectionStart = t.selectionEnd = now.length
      if (was.trim() && !now.trim()) U.boxGone = { k: U.draftKey, t: Date.now() }
      bump('composer')
    }
  }
  if (e.key.startsWith('taska.drafts.')) draftMarks()
}
// A2: an item with an unsent draft was merged: the words and files go after the draft of the item it went into.
export function mergeDrafts(): [string, string][] {
  const keys = new Set(
      [...Object.keys(draftStore()), ...Object.keys(U.parked), U.draftKey || ''].filter((k) =>
        /^[A-Z]\d+$/.test(k || ''),
      ),
    ),
    moved: [string, string][] = []
  for (const key of keys) {
    const n = parseRef(key)
    if (!n || !byN.get(n)?.merged_into || liveN(n) === n) continue
    const to = code(liveN(n))
    if (key === U.draftKey) {
      saveDraft()
      U.parked[key] = U.files
      U.files = []
      if (els.text) els.text.value = ''
      U.draftKey = null
    }
    const text = draftStore()[key] || '',
      files = U.parked[key] || []
    draftStore((all) => {
      delete all[key]
    })
    delete U.parked[key]
    if (!text.trim() && !files.length) continue
    const was = to === U.draftKey ? (els.text?.value ?? '') : draftStore()[to] || '',
      wasFiles = to === U.draftKey ? U.files : U.parked[to] || []
    for (const f of files) {
      f.key = to
      f.scope = to
      f.at = undefined
      keepRec(f)
    }
    setDraft(to, was.trim() ? was.trimEnd() + '\n\n' + text : text, [...wasFiles, ...files])
    moved.push([key, to])
  }
  return moved
}
export function setDraft(key: string, text: string, files: DraftFile[]) {
  if (key === U.draftKey) {
    if (els.text) els.text.value = text
    U.files = files
    saveDraft()
  } else {
    draftStore((all) => {
      if (text.trim()) all[key] = text
      else delete all[key]
    })
    if (files.length) U.parked[key] = files
    else delete U.parked[key]
  }
}
// A8, B185: "New input instead", "Add to F06 instead", "As a rule instead": what you wrote goes to the other target,
// after its own draft, and Undo puts both back.
export function carry(go: () => void) {
  const from = U.draftKey,
    text = els.text?.value ?? '',
    files = U.files
  if (!from || (!text.trim() && !files.length)) return go()
  setDraft(from, '', [])
  go()
  syncDraft()
  const to = U.draftKey as string
  if (to === from) {
    setDraft(to, text, files)
    bump('composer')
    return
  }
  const was = els.text?.value ?? '',
    wasFiles = [...U.files]
  for (const f of files) {
    f.key = to
    f.scope = /^[A-Z]\d+$/.test(to) ? to : null
    f.at = undefined
    keepRec(f)
  }
  setDraft(to, was.trim() ? was.trimEnd() + '\n\n' + text : text, [...wasFiles, ...files])
  bump('composer')
  toast(`Draft moved to ${draftName(to)}`, () => {
    for (const f of files) {
      f.key = from
      f.scope = /^[A-Z]\d+$/.test(from) ? from : null
      keepRec(f)
    }
    setDraft(to, was, wasFiles)
    setDraft(from, text, files)
    goDraft(from)
    bump('composer')
  })
  els.text?.focus({ preventScroll: true })
}
// When the box's target changes, its draft changes with it (called before every redraw).
export function syncDraft() {
  if (!model.S.project) return
  const k = draftKey()
  if (k !== U.draftKey) swapDraft(k)
}
function swapDraft(key: string) {
  const left = U.draftKey === 'new' && ((els.text?.value ?? '').trim() || U.files.length) ? U.draftKey : null // B185
  if (U.draftKey) {
    saveDraft()
    U.parked[U.draftKey] = U.files
  }
  if (left && !R_STATE.rec)
    setTimeout(() =>
      toast('Your new input is kept, not sent', () => goDraft(left), {
        label: 'Open',
      }),
    )
  const t = els.text
  if (t) {
    t.value = draftStore()[key] || ''
    t.selectionStart = t.selectionEnd = t.value.length // the caret after your words
  }
  U.files = U.parked[key] || []
  delete U.parked[key]
  U.draftKey = key
}
// The name of a draft's target, for what the box says about it (B1, B185).
export const draftName = (key: string) =>
  key === 'new'
    ? 'a new input'
    : key === 'rule'
      ? 'a new rule'
      : /^[A-Z]\d+$/.test(key)
        ? key
        : key.replace(/ r(\d+)$/, ' #$1').replace(
            // an input's number reads #461 here too, as everywhere
            /^(\w+) /,
            (_, m: string) =>
              ({
                edit: 'the edit of ',
                append: 'the details for ',
                correct: 'the correction in ',
                dc: 'the edit of comment ',
                doc: 'the comment on D',
              })[m] || '',
          )
export function goDraft(key: string) {
  // to the box a draft belongs to
  if (key === 'new') {
    return ACT['new-input']({})
  }
  const dm = /^doc (\d+)$/.exec(key),
    doc = dm && docById(Number(dm[1]))
  if (doc) {
    const h = liveN(doc.n),
      it = byN.get(h)
    if (it) {
      if (!inTab(it, U.tab)) setTab(tabOf(it))
      if (U.open !== h) openItem(h)
    }
    openDoc(doc.d)
    return
  } // B298
  // B362: the box for adding to, or editing, one of your inputs: New input, with the box on that input
  const am = /^(edit|append) (\S+)$/.exec(key)
  if (am) {
    if (!byR.has(am[2])) return toast('Input no longer exists', null, { error: true })
    ACT['new-input']({})
    return ACT[am[1] === 'edit' ? 'input-edit' : 'input-append']({ id: am[2] })
  }
  const n = /^[A-Z]\d+$/.test(key) && parseRef(key)
  if (n && byN.has(n)) {
    const it = byN.get(n)
    if (desk() && it && !inTab(it, U.tab)) setTab(tabOf(it))
    openItem(n)
    els.text?.focus({ preventScroll: true })
    return
  }
  // B366: the other boxes a draft can belong to
  const cm = /^correct (\S+)$/.exec(key)
  if (cm && byR.has(cm[1])) {
    ACT['new-input']({})
    U.correct = { id: cm[1], wrong: '', v: byR.get(cm[1])?.v || 0 }
    render()
    return els.text?.focus()
  }
  const dc = /^dc (\d+)$/.exec(key)
  if (dc) {
    const id = Number(dc[1]),
      d = (model.S.docs || []).find((x) => dcFind(x.d, id))
    if (d) {
      const it = byN.get(liveN(d.n))
      if (it && U.open !== it.n) openItem(it.n)
      openDoc(d.d)
      return editComment(d.d, id)
    }
  }
  if (key === 'prefs') {
    openProject('fixes')
    return ACT['prefs-edit']({})
  }
  // what the box was for is gone: say which, never a Go there that does nothing
  toast(`${draftName(key).replace(/^the /, 'The ')} is gone`, null, { error: true })
}

// Half-written text has one rule (T113 B6): leaving it any way but Cancel or Discard keeps it as a draft, until you
// save, send or discard it: an item's edit, a subitem's title, a document. Kept per project in this browser.
export function kept(kind: string, change?: (all: Record<string, unknown>) => void): Record<string, unknown> {
  const key = `taska.${kind}.${model.S.project}`
  try {
    const all = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, unknown>
    if (change) {
      change(all)
      localStorage.setItem(key, JSON.stringify(all))
    }
    return all
  } catch {
    return {}
  }
}
// T257 #4: pictures and files in a draft survive a reload of this tab (sessionStorage). Voice notes keep their own way.
const filesKey = () => 'taska.draftfiles.' + ctx.HERE
export function keepDraftFiles() {
  const all: Record<string, DraftFile[]> = { ...U.parked, ...(U.draftKey ? { [U.draftKey]: U.files } : {}) },
    out: Record<string, unknown[]> = {}
  for (const [k, fs] of Object.entries(all)) {
    const ok = (fs || [])
      .filter((f) => f.f && !f.failed && !(f.mime || '').startsWith('audio/'))
      .map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size }))
    if (ok.length) out[k] = ok
  }
  try {
    sessionStorage.setItem(filesKey(), JSON.stringify(out))
  } catch {
    /* no storage */
  }
}
export function restoreDraftFiles() {
  try {
    for (const [k, fs] of Object.entries(
      JSON.parse(sessionStorage.getItem(filesKey()) || '{}') as Record<string, DraftFile[]>,
    ))
      U.parked[k] = fs.map((f) => ({ ...f, done: Promise.resolve() }))
  } catch {
    /* no storage */
  }
}
export const overlayShown = () => !!OV.spec
