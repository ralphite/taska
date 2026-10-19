// Documents (D1, D2 ...): a note on an item, its first line the title. On the desktop it opens in the item pane, in place
// of its item (T110, D20 2.5); on the phone in a sheet. Comments go through the one input box (I087): the passage you
// picked, the words you selected, or a thread you reply in; nothing picked, the whole document (B247).
import {
  D,
  OV,
  U,
  bump,
  byN,
  code,
  dcFind,
  desk,
  docById,
  docOpen,
  docsOf,
  els,
  liveN,
  render,
  sameText,
  seenMap,
  saveSeen,
} from './state'
import type { Comment, Doc } from './types'
import { toast } from './toast'
import { pushUndo, save } from './data'
import { draftStore, kept, markSent, saveDraft } from './drafts'
import { closeDialog, openDialog } from './dialog'
import { layersNow, leaveView, writeURL } from './url'
import { docRecStop, dropRec } from './voice'
import { sleep } from './state'

export const noteText = (d: Doc) =>
  sameText(d.md.split('\n')[0].replace(/^#+\s*/, ''), d.title) ? d.md : `# ${d.title}\n\n${d.md}`
export const docKey = () => (U.doc ? `D${U.doc}` : `new ${U.docNew}`) // where a document's draft is kept

export interface DocTarget {
  d: Doc
  key: string
  quote: string
  reply?: boolean
  many?: number
  whole?: boolean
}
export function docTarget(): DocTarget | null {
  const d = docOpen()
  if (!d) return null
  if (U.docReply) {
    const b = d.blocks.find((b) => b.key === U.docReply),
      t = d.detached.find((t) => t.key === U.docReply)
    return { d, key: U.docReply, reply: true, quote: b?.text || t?.quote || '' }
  }
  const blocks = d.blocks.filter((b) => U.docSel.has(b.key))
  if (U.docQuote) return { d, key: U.docQuote.key, quote: U.docQuote.text }
  return blocks.length
    ? { d, key: blocks[0].key, quote: blocks.map((b) => b.text).join('\n'), many: blocks.length }
    : null
}

// T274 #2: a thread can be resolved; an agent's word you have not seen has a blue dot until the document shows it
export function threadNew(d: Doc, key: string, comments: Comment[]) {
  const c = comments.at(-1)
  return !!c && c.by !== 'you' && Date.parse(c.t) > Date.parse(seenMap()[`D${d.d}:${key}`] || seenMap().since)
}
export function seeThreads(d: Doc) {
  const m = seenMap()
  let changed = false
  for (const [key, cs] of [...d.blocks.map((b) => [b.key, b.comments] as const), ['doc', d.whole || []] as const]) {
    const c = cs.at(-1)
    if (c && threadNew(d, key, cs)) {
      m[`D${d.d}:${key}`] = c.t
      changed = true
    }
  }
  if (changed) saveSeen()
}

function pickBack(d: number) {
  // B265: words waiting in the box for a passage still go to that passage
  const m = U.docPick?.[d]
  if (m && ((els.text?.value ?? '').trim() || U.files.length))
    Object.assign(U, { docSel: new Set(m.sel), docQuote: m.quote, docReply: m.reply })
}
export function openDoc(d: number) {
  if (U.doc !== d)
    setTimeout(() =>
      !desk() && layersNow().at(-1) === 'sheet' && OV.spec ? writeURL(false, { v: `D${d}` }) : writeURL(true),
    ) // B150
  if (desk()) {
    // T110: in the item pane, under its item (a merged one's: the item it went into, B5)
    const doc = docById(d),
      host = doc && liveN(doc.n)
    if (doc && host != null && U.open !== host && byN.has(host)) U.open = host
    if (OV.spec) OV.spec = null // the editor, when you come back from it
    Object.assign(U, {
      peek: null,
      doc: d,
      docReply: null,
      docNew: null,
      docEdit: false,
      docText: null,
      docSel: new Set(),
      docQuote: null,
      docCircle: false,
    })
    if (D.compose) D.compose = false // a document shows in the item pane, never under the New input page
    pickBack(d)
    D.docKey = null
    render()
    return
  }
  Object.assign(U, {
    peek: null,
    doc: d,
    docReply: null,
    docNew: null,
    docEdit: false,
    docText: null,
    docSel: new Set(),
    docQuote: null,
    docCircle: false,
  })
  U.docType = !!(String(draftStore()[`doc ${d}`] || '').trim() || U.parked[`doc ${d}`]?.length) // B298
  pickBack(d)
  U.docDrafts.note = ''
  renderDoc({ focus: true })
  requestAnimationFrame(() => {
    const b = document.getElementById('dlgBody')
    if (b) b.scrollTop = U.docScroll[d] || 0
  })
}
// The sheet on the phone (the desktop draws the document in the item pane).
export function renderDoc({ focus = false } = {}) {
  if (U.docEdit) {
    const d = docById(U.doc)
    if (desk() && d) {
      D.docKey = null
      render()
      return
    } // T274 #11: an existing document is edited where it is read
    openDialog('doc-edit', {}, { focus: false, tall: true })
    return
  }
  const d = docById(U.doc)
  if (desk()) {
    if (!d) U.doc = null
    render()
    return
  }
  if (!d) return closeDialog()
  openDialog('doc', { d: d.d }, { focus, tall: true, aboveComposer: !!U.docType }) // I285: no box below unless you chose to type
  bump()
}
export function closeDoc() {
  // the desktop's way back from a document to its item
  if (!U.doc) return
  if (U.docEdit) {
    keepDoc()
    U.docEdit = false
    U.docText = null
    return openDoc(U.doc)
  } // Esc in the editor: back to reading, the edit kept as a draft
  const d = U.doc
  U.docScroll[d] = els.detailBody?.scrollTop || 0
  Object.assign(U, { doc: null, docReply: null, docSel: new Set(), docQuote: null, docCircle: false })
  D.docKey = null
  getSelection()?.removeAllRanges()
  render()
  if (!leaveView(`D${d}`)) writeURL(false)
}
export function newDoc(n: number) {
  Object.assign(U, {
    peek: null,
    doc: null,
    docNew: n,
    docEdit: true,
    docText: (kept('docs')[`new ${n}`] as string) || '',
  })
  renderDoc()
  if (U.docText) toast('Your draft is back')
  requestAnimationFrame(() => document.getElementById('docMd')?.focus())
}
export const docMdValue = () => (document.getElementById('docMd') as HTMLTextAreaElement | null)?.value
export function keepDoc() {
  // leaving the editor without Create or Save keeps the text as a draft (T113 B6)
  docRecStop() // its words go into the draft when they come (F208)
  const d = docById(U.doc),
    md = (docMdValue() ?? U.docText ?? '').trim(),
    key = docKey(),
    was = d ? noteText(d).trim() : ''
  kept('docs', (all) => {
    if (md && md !== was) all[key] = md
    else delete all[key]
  })
  if (md && md !== was)
    toast(
      d
        ? `Your edit of D${d.d} is kept as a draft: Edit brings it back`
        : `Your new document is kept as a draft: ${desk() ? '⇧D' : 'New doc'} brings it back`,
    )
}
export async function saveDoc() {
  // leaving the editor saves; an empty new note is dropped
  const md = (docMdValue() ?? U.docText ?? '').trim(),
    d = docById(U.doc),
    n = U.docNew,
    key = docKey()
  U.docEdit = false
  U.docText = null
  kept('docs', (all) => delete all[key])
  if (!md || (d && md === noteText(d).trim())) return d
  return saveDocText(d, n, md)
}
async function saveDocText(d: Doc | undefined, n: number | null, md: string) {
  try {
    if (d) {
      await save({ op: 'doc', d: d.d, md })
      toast('Saved')
      return docById(d.d)
    }
    await save({ op: 'doc', ref: code(n), md })
    toast('Document created')
    return docById(Math.max(...docsOf(n as number).map((x) => x.d)))
  } catch {
    // not saved (T160): the editor comes back with your text, and Done tries again
    Object.assign(U, { doc: d ? d.d : null, docNew: d ? null : n, docEdit: true, docText: md })
    renderDoc()
    return null
  }
}

// B258: your own comment can be changed or deleted; an agent's can be deleted, not edited (F262).
export function editComment(dn: number, id: number) {
  const c = dcFind(dn, id)
  if (!c) return
  U.amend = { mode: 'dc', d: dn, id, was: c.text }
  bump()
  const t = els.text
  if (!t) return
  if (!t.value.trim()) {
    t.value = c.text
    saveDraft()
    bump('composer')
  }
  t.focus()
  t.selectionStart = t.selectionEnd = t.value.length
}
export async function deleteComment(dn: number, id: number) {
  try {
    await save({ op: 'dcdel', d: dn, id }, () => deleteComment(dn, id))
  } catch {
    return
  }
  render()
  toast(
    'Comment deleted',
    pushUndo(`Delete a comment on D${dn}`, async () => {
      await save({ op: 'dcundel', d: dn, id })
      render()
      toast('Comment back')
    }),
  )
}

// B259: it takes what any box takes: words, pictures, files and voice notes. The box is empty at once; a voice note's
// words go into the comment once they are in. Not saved: all of it comes back into the box.
export async function sendDocComment(t: DocTarget) {
  const box = els.text
  if (!box) return
  const typed = box.value.trim(),
    drafts = [...U.files]
  if (!typed && !drafts.length) return
  markSent(U.draftKey)
  box.value = ''
  U.files = []
  saveDraft()
  bump('composer')
  const back = () => {
    box.value = [typed, box.value.trim()].filter(Boolean).join('\n')
    U.files = [...drafts, ...U.files]
    saveDraft()
    bump('composer')
  }
  let files
  try {
    await Promise.all(drafts.map((f) => f.done))
    if (drafts.some((f) => f.transcribing)) toast('Posting as soon as the words of the voice note are in…')
    for (let i = 0; drafts.some((f) => f.transcribing) && i < 240; i++) await sleep(500)
    files = drafts.filter((f) => f.f && !f.failed)
    let text = typed
    for (const f of files) if (f.tr && !text.includes(f.tr)) text = (text ? text + '\n' : '') + f.tr
    if (!text && !files.length) return back()
    await save(
      {
        op: 'dc',
        d: t.d.d,
        key: t.key,
        text,
        files: files.map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) })),
        ...(t.reply ? {} : { quote: t.quote }),
      },
      () => {
        const t2 = docTarget() || (docOpen() && { d: docOpen() as Doc, key: 'doc', quote: '', whole: true })
        if (t2) sendDocComment(t2)
      },
    )
  } catch {
    return back()
  }
  for (const f of files) {
    f.sent = true
    dropRec(f)
  }
  U.docThreads.add(t.key)
  U.docSel = new Set()
  U.docQuote = null
  U.docReply = null // T274 #3: sent, the box is the document's again
  if (U.lastSent) U.lastSent = null
  getSelection()?.removeAllRanges()
  render()
  toast(t.reply ? 'Reply added' : 'Comment added')
  if (desk()) els.text?.focus({ preventScroll: true })
}
export const docSig = (d: Doc | undefined) =>
  d
    ? `${d.title}|${d.md}|${[
        ...(d.whole || []),
        ...d.blocks.flatMap((b) => b.comments),
        ...d.detached.flatMap((t) => t.comments),
      ]
        .map((c) => c.id + (c.edited || ''))
        .join()}`
    : ''
export const docHost = (d: Doc) => liveN(d.n)
