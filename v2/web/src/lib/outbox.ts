// Sending never holds the box (F85): what you wrote goes into the outbox, the box is empty at once for the next
// thought, and the outbox sends in order as soon as each input's uploads and transcripts are in. An input that has not
// reached Taska yet is kept in this browser too (B151): a reload or a closed page never loses it.
import {
  talkScroller,
  D,
  R_STATE,
  U,
  bump,
  byN,
  byR,
  code,
  ctx,
  dcFind,
  desk,
  docOpen,
  els,
  liveN,
  model,
  render,
  rcode,
  scopeN,
  type DraftFile,
  type Job,
  answerOf,
} from './state'
import { FAILED, dropFailed, toast } from './toast'
import {
  load,
  instant,
  op,
  optimistic,
  standIn,
  pushUndo,
  forget,
  sendLog,
  notSaved,
  saidOp,
  answersGoing,
  type OpAnswer,
} from './data'
import { ticksDone, ticksGoing, ticksOf, tickWords } from './doctick'
import { actLog } from './actlog'
import type { Doc } from './types'
import { setFix } from './settings'
import {
  draftName,
  draftStore,
  goDraft,
  keepChoice,
  markSent,
  saveDraft,
  setDraft,
  draftMarks,
  syncDraft,
} from './drafts'
import { docTarget, sendDocComment, renderDoc } from './docs'
import { advance, advanceDesk, peek } from './go'
import { finishRec, dropRec, keepRec, plainFile, sendVoiceComments, vcCount } from './voice'
import { sendPrefs } from './settings'

export const grow = () => bump('composer')

export function addFiles(list: File[]) {
  // C1 (T422): kept in this browser and sent again until Taska has it; a sent input waits for its files (F85)
  for (const file of list) U.files.push(plainFile(file))
  bump('composer')
}

export async function send() {
  if (R_STATE.rec) return finishRec(true)
  if (U.prefsEdit) return sendPrefs() // F183
  if (U.correct) return sendCorrect() // F144
  if (U.amend) return sendAmend() // details for an input you sent (B136)
  const box = els.text
  if (!box) return
  if (docOpen() && vcCount(box.value)) return sendVoiceComments() // F184
  const td = docOpen()
  if (td && !docTarget() && ticksOf(td).length) return sendTicks(td)
  const dt = docTarget()
  if (dt) return sendDocComment(dt) // a document comment (I087)
  const od = docOpen()
  if (od && !desk()) return sendDocComment({ d: od, key: 'doc', quote: '', whole: true }) // B247: the phone: on the whole document
  // B340 (D24 #6): on the desktop, nothing picked is a reply to the item the document is on
  const n = scopeN(),
    ch =
      n && U.choice?.n === n && U.choice.picked.size // B145: ticked choices go with what you wrote
        ? [...U.choice.picked]
            .sort((a, c) => a - c)
            .map((i) => '✓ ' + (U.choiceLabels[n] || [])[i])
            .join('\n')
        : ''
  const text = [ch, box.value.trim()].filter(Boolean).join('\n\n')
  if (!text && !U.files.length) return
  if (ch) {
    U.choice = null
    keepChoice()
  }
  U.note = null
  const job = outboxPush({
    text,
    files: U.files,
    scope: n ? code(n) : null,
    ...(ch ? { kind: 'answer' as const } : {}),
  }) // F419: ticked choices
  actLog('send', { to: job.scope || 'new input', q: job.q, chars: text.length, files: job.files.length }) // F407
  unsendable(job)
  box.value = ''
  U.files = []
  saveDraft()
  // Going through what needs you, your reply settles this one (B118), but the box stays on it (A2, B146).
  const going = U.go && n && U.go.list.includes(n) && (n === U.peek || (desk() && n === U.open))
  if (going && U.go && n) {
    U.go.done.add(n)
    U.go.how[n] = 'Replied'
    if (U.peek) peek(U.peek, { focus: false })
  } else if (U.peek && n === U.peek)
    advance(U.peek, `Sent to ${code(n)}`) // B155
  else if (!desk() && !n && U.tab === 'inputs' && !U.open && els.inputsView) els.inputsView.scrollTop = 0
  if (desk()) box.focus({ preventScroll: true }) // A1
  render()
  flushOutbox()
  if (desk() && D.compose && els.foot) els.foot.scrollTop = 0
  else if (desk() && n && n === U.open && !U.go)
    requestAnimationFrame(() => {
      const talk = talkScroller()
      if (talk) talk.scrollTop = talk.scrollHeight
    }) // B124
}
// B412: the choices ticked in a document go in at once: into its text, and to its item as one reply (with your note)
async function sendTicks(doc: Doc) {
  const box = els.text,
    note = box?.value.trim() || '',
    n = liveN(doc.n),
    sent = Object.fromEntries(ticksOf(doc).map(({ k, now }) => [k, now])),
    words = tickWords(doc)
  if (byN.has(n)) {
    outboxPush({
      text:
        [`Answered in D${doc.d}:`, ...(words.length ? words : ['nothing ticked'])].join('\n') +
        (note ? '\n\n' + note : ''),
      files: U.files,
      scope: code(n),
      kind: 'answer', // F419
    })
    if (box) box.value = ''
    U.files = []
    saveDraft()
    flushOutbox()
    if (!desk()) toast(`Choices sent to ${code(n)}`) // the desktop's box says Sent already
  }
  if (!desk()) U.docType = false // the phone: the box leaves the document again, as before you ticked
  saveTicks(doc.d, sent)
}
// B1, B2 (T422): only the choices go, into the document as it is when they get there (an agent may have changed the
// rest meanwhile), as a change kept in this browser until Taska has it, so a reload or a closed tab loses nothing
function saveTicks(d: number, sent: Record<string, string>) {
  ticksGoing(d, sent) // still shown ticked; the box no longer says they wait
  render()
  const ticks = Object.entries(sent).map(([k, text]) => {
    const [key, occ] = k.split('~')
    return { key, occ: Number(occ) || 0, text }
  })
  const after = (ok: boolean) => {
    ticksDone(d, sent, ok) // not taken: they wait again, as you ticked them
    renderDoc()
    bump('composer')
  }
  void optimistic([], { op: 'dticks', d, ticks }, () => after(false)).then((ok) => ok && after(true))
}
export function outboxPush(job: Omit<Job, 'id' | 'q' | 't' | 'p'> & Partial<Job>): Job {
  const j = job as Job
  Object.assign(j, {
    id: 'q' + ++U.qn,
    q: Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
    t: Date.now(),
    p: j.p || ctx.P,
  })
  for (const f of j.files)
    if (f.rid) {
      f.job = { id: j.q, text: j.text }
      keepRec(f)
    } // its words come back with it after a reload
  U.outbox.push(j)
  keepJob(j)
  markSent(jobKey(j)) // T113 A10: the other tabs drop it from their box
  return j
}
export const jobKey = (job: Job) => job.scope || 'new' // the box it was written in
// T113 A27: what you just sent can be taken back for a short while, with Undo or Z.
const UNSEND_MS = 10000
function unsendable(job: Job) {
  const run = pushUndo(`Send to ${draftName(jobKey(job))}`, () => unsend(job))
  job.undo = run
  U.sentJobs = [...U.sentJobs, job]
  setTimeout(() => {
    forget(run)
    job.undo = undefined
    U.sentJobs = U.sentJobs.filter((j) => j !== job)
    bump('feedback')
  }, UNSEND_MS)
}
async function unsend(job: Job) {
  const key = jobKey(job),
    i = U.outbox.indexOf(job)
  if (i >= 0 && !job.sending) {
    U.outbox.splice(i, 1)
    dropJob(job)
  } else {
    // C5 (T422): on its way: your words come back at once and it leaves the list; once Taska has it, it is deleted
    // there behind you (kept and sent again like any change)
    job.unsent = true
    void (async () => {
      while (U.outbox.includes(job)) await new Promise((r) => setTimeout(r, 200))
      const r = job.rid && byR.get(job.rid)
      if (!job.rid) return
      if (r && (r.acked || model.S.org.busy === r.id || r.org)) {
        job.unsent = false
        return toast(
          `${rcode(job.rid)} already reached ${r.org ? 'the organizer' : 'your agent'}; delete it from Inputs`,
        )
      }
      void instant({ op: 'delete', id: job.rid }, () => {
        model.S.inputs = model.S.inputs.filter((x) => x.id !== job.rid)
        byR.delete(job.rid as string)
      })
      if (U.lastSent === job.rid) U.lastSent = null
    })()
  }
  const files = job.files.filter((f) => !f.failed).map((f) => Object.assign(f, { sent: false, job: null }))
  const was = key === U.draftKey ? (els.text?.value ?? '') : String(draftStore()[key] || ''),
    wasFiles = key === U.draftKey ? U.files : U.parked[key] || []
  setDraft(key, was.trim() ? job.text + '\n\n' + was : job.text, [...files, ...wasFiles])
  draftMarks()
  render()
  if (key === U.draftKey) els.text?.focus({ preventScroll: true })
  toast(
    key === U.draftKey ? 'Not sent. Text restored' : `Not sent. Text restored to ${draftName(key)}`,
    key === U.draftKey ? null : () => goDraft(key),
    { label: 'Open' },
  )
}
// B414: what you sent and is not in yet, kept in this browser by project ('taska.outbox.<project>')
const OUTBOX = 'taska.outbox.'
const projectOf = (p: string) => decodeURIComponent(p.replace(/^\/p\//, '').replace(/\/$/, ''))
function outboxStore(change?: (all: Record<string, unknown>) => void, project = model.S.project) {
  const key = OUTBOX + project
  try {
    const all = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, unknown>
    if (change) {
      change(all)
      if (Object.keys(all).length) localStorage.setItem(key, JSON.stringify(all))
      else localStorage.removeItem(key)
    }
    return all
  } catch {
    return {}
  }
}
export const keepable = (job: Job) => job.files.every((f) => f.f && !f.rid)
function keepJob(job: Job) {
  if (keepable(job))
    outboxStore((all) => {
      all[job.q] = {
        text: job.text,
        scope: job.scope,
        t: job.t,
        ...(job.kind ? { kind: job.kind } : {}),
        files: job.files.map(({ f, name, mime, size }) => ({ f, name, mime, size })),
      }
    }, projectOf(job.p))
}
const dropJob = (job: Job) =>
  outboxStore((all) => {
    delete all[job.q]
  }, projectOf(job.p))
type KeptJob = { text?: string; scope?: string; t?: number; kind?: 'answer'; files?: DraftFile[] }
export function restoreOutbox() {
  // what did not go out last time goes now, in the order you sent it, whichever project it was written in (B414)
  const mine = new Set(U.outbox.map((j) => j.q)),
    back: [string, string, KeptJob][] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(OUTBOX))
        for (const [q, j] of Object.entries(outboxStore(undefined, k.slice(OUTBOX.length))) as [string, KeptJob][])
          if (!mine.has(q)) back.push([k.slice(OUTBOX.length), q, j])
    }
  } catch {
    /* no storage */
  }
  back.sort((a, b) => (a[2].t || 0) - (b[2].t || 0))
  for (const [project, q, j] of back)
    U.outbox.push({
      id: 'q' + ++U.qn,
      q,
      t: j.t || Date.now(),
      text: j.text || '',
      scope: j.scope || null,
      p: '/p/' + encodeURIComponent(project) + '/',
      back: true,
      ...(j.kind ? { kind: j.kind } : {}),
      files: (j.files || []).map((f) => ({ ...f, done: Promise.resolve() })),
    })
  if (back.length) {
    sendLog('resend', `Retrying ${back.length} pending ${back.length === 1 ? 'input' : 'inputs'}`)
    if (back.some(([, , j]) => j.kind === 'answer')) {
      answersGoing() // T438 #1: an answer kept from before the reload shows as answered, as before it
      render()
    }
    bump('feedback')
    flushOutbox()
  }
}
export function resendOutbox() {
  // the connection is back: what failed for want of it goes now
  let again = false
  for (const j of U.outbox)
    if (j.failed && j.net) {
      j.failed = false
      again = true
    }
  if (again) {
    bump('feedback')
    flushOutbox()
  }
}
class Again extends Error {
  again = true
}
async function sendInput(o: unknown, p: string): Promise<OpAnswer> {
  let d: OpAnswer
  try {
    d = await (
      await fetch(p + 'api/op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(o),
      })
    ).json()
  } catch {
    throw new Again('no answer')
  }
  if (!d.ok) {
    toast((d.res || []).find((x) => x.startsWith('err')) || d.error || 'Not saved')
    throw new Error('op failed')
  }
  if (p !== ctx.P) return d // B414: written in another project: the page here has nothing new to show
  try {
    await load()
  } catch {
    /* it is in; the next poll shows it */
  }
  return d
}
// B155: what you sent shows up where you are, in view and lit up for a moment.
export function showSent(rid: string | null | undefined, scope: string | null) {
  if (!rid) return
  const el =
    scope && U.open && code(U.open) === scope
      ? document.querySelector(`#detailBody [data-src="${rid}"]`)
      : U.tab === 'inputs' && (desk() || !U.open)
        ? (desk() && ((U.inSel = rid), render()),
          document.querySelector(`:is(#inputsView, #detailBody) [data-r="${rid}"]`))
        : null
  if (!el) return
  el.scrollIntoView({ block: 'nearest' })
  el.classList.add('bg-blue-50', 'dark:bg-blue-400/10')
  setTimeout(() => el.classList.remove('bg-blue-50', 'dark:bg-blue-400/10'), 1500)
}
const FLUSH = { busy: false }
export async function flushOutbox() {
  if (FLUSH.busy) return
  FLUSH.busy = true
  let sent: [string, string | null] | null = null
  try {
    while (U.outbox.length && !U.outbox[0].failed) {
      const job = U.outbox[0]
      await Promise.all(job.files.map((f) => f.done))
      if (job.files.length) keepJob(job) // its files are up now: kept with them (B151)
      const files = job.files.filter((f) => f.f && !f.failed)
      if (files.length < job.files.length)
        sendLog(
          'file left out',
          `${job.q} (${projectOf(job.p)}): ${job.files.length - files.length} file(s) never got up`,
        )
      let text = job.text
      for (const f of files) if (f.tr && !f.trAdded && !text.includes(f.tr)) text = (text ? text + '\n' : '') + f.tr // a transcript that came after you sent
      if (!text && !files.length) {
        U.outbox.shift()
        dropJob(job)
        continue
      }
      job.sending = true
      bump('feedback')
      try {
        const d = await sendInput(
          {
            op: 'input',
            text,
            scope: job.scope,
            q: job.q,
            ...(job.kind ? { kind: job.kind } : {}),
            files: files.map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) })),
          },
          job.p,
        )
        job.rid = d.res[0].split(' ')[1]
        if (job.tries || job.back)
          sendLog(
            'sent late',
            `${job.q} (${projectOf(job.p)}) in after ${Math.round((Date.now() - job.t) / 1000)} s, ${job.tries || 0} failed tries${job.back ? ', after a reload' : ''}${job.files.some((f) => f.rid) ? ', voice' : ''}`,
          )
        const here = job.p === ctx.P
        if (here) U.lastSent = job.quiet || job.unsent ? null : job.rid
        U.outbox.shift()
        dropJob(job)
        if (here && !job.unsent) sent = [job.rid, job.scope]
        for (const f of files) {
          f.sent = true
          dropRec(f)
        } // words still to come go onto this input, on the server (B165)
      } catch (e) {
        job.failed = true
        job.sending = false
        job.net = !!(e as { again?: boolean }).again
        sendLog(
          'unsent',
          `${job.q} (${projectOf(job.p)}) ${job.net ? 'no answer from Taska' : 'refused: ' + ((e as Error).message || '')}, try ${(job.tries || 0) + 1}${job.files.some((f) => f.rid) ? ', voice' : ''}`,
        )
        if (job.net)
          setTimeout(
            () => {
              if (job.failed && U.outbox[0] === job) {
                job.failed = false
                bump('feedback')
                flushOutbox()
              }
            },
            Math.min(30000, 2000 * 2 ** Math.min((job.tries = (job.tries || 0) + 1), 4)),
          )
      }
    }
  } finally {
    FLUSH.busy = false
    render()
    if (sent) showSent(...sent)
  }
}
export function warnUnload(e: BeforeUnloadEvent) {
  // B317: leaving never asks: drafts, voice notes and edits are kept here; only a recording still going would be lost
  if (R_STATE.rec) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// B4: words (and files) you wrote in the box for an item go with your decision on it (Accept, Approve, Not yet, Won't do).
export function noteWith(n: number) {
  if (scopeN() !== n || U.amend || U.correct || docOpen() || R_STATE.rec) return false
  const box = els.text,
    text = (box?.value ?? '').trim(),
    files = U.files
  if (!text && !files.length) return false
  outboxPush({ text, files, scope: code(n), quiet: true }) // the decision's toast says "with your note" (T113 A19)
  if (box) box.value = ''
  U.files = []
  saveDraft()
  bump('composer')
  flushOutbox()
  return true
}

// ---------------------------------------------------------------- the box's other jobs

// Taska said no to an edit, a fix or a comment change: your words come back in the box, on what they were for (unless
// you are writing something else by then; the list of what is not saved still says what it was)
function putBack(set: () => void, text: string, files: DraftFile[] = []) {
  if (els.text?.value.trim() || U.amend || U.correct) return
  set()
  syncDraft()
  if (els.text) els.text.value = text
  U.files = files
  saveDraft()
  render()
}
export async function sendAmend() {
  const a = U.amend,
    box = els.text,
    at = ctx.P // B527: what you add or change goes to this project, wherever you are once its voice note is up
  if (!a || !box) return
  const text = box.value.trim(),
    drafts = [...U.files]
  if (a.mode === 'dc') {
    // B258
    if (!text && !drafts.length && !dcFind(a.d, a.id)?.files?.length)
      return toast('Write something, or delete the comment instead')
    // B3, B4 (T422): the comment changes at once and is saved behind you
    box.value = ''
    U.files = []
    saveDraft()
    U.amend = null
    const was = dcFind(a.d, a.id)?.text
    const gone = standIn(() => {
      const c = dcFind(a.d, a.id)
      if (c && text) c.text = text
    })
    renderDoc()
    render()
    if (desk()) box.focus({ preventScroll: true })
    await Promise.all(drafts.map((f) => f.done)) // T257 #3: what you added goes along once uploaded
    const files = drafts
      .filter((f) => f.f && !f.failed)
      .map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size, tr: f.tr }))
    await optimistic(
      [],
      { op: 'dcedit', d: a.d, id: a.id, text, ...(files.length ? { files } : {}) },
      () => {
        // Taska said no (it says why): your words come back to edit
        putBack(() => (U.amend = a), text || was || '', drafts)
      },
      undefined,
      { p: at },
    )
    gone()
    renderDoc()
    render()
    return
  }
  if (!text && !drafts.length) return box.focus()
  // B437, T441: the box is empty at once and the input shows your words; it is saved behind you and sent again until
  // Taska has it. Only a refusal puts your words back in the box (and in the list of what is not saved).
  box.value = ''
  U.files = []
  saveDraft()
  U.amend = null
  const add = (r: { text: string }) =>
    a.mode === 'edit' ? text : r.text.endsWith(text) ? r.text : [r.text, text].filter(Boolean).join('\n\n')
  const gone = text
    ? standIn(() => {
        const r = byR.get(a.id)
        if (r) r.text = add(r)
      })
    : () => {}
  toast(a.mode === 'edit' ? `${rcode(a.id)} updated` : `Added to ${rcode(a.id)}`)
  render()
  if (desk()) box.focus({ preventScroll: true })
  await Promise.all(drafts.map((f) => f.done)) // a voice note or screenshot goes along once uploaded (B168)
  const files = drafts
    .filter((f) => f.f && !f.failed)
    .map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size, tr: f.tr }))
  const said = saidOp({ op: 'amend', id: a.id, mode: a.mode })
  let refused = false
  const ok = await optimistic(
    [],
    { op: 'amend', id: a.id, mode: a.mode, v: a.v, text, files },
    (ex) => {
      if (!(ex as { net?: boolean })?.net) refused = true
      else {
        putBack(() => (U.amend = a), text, drafts)
        notSaved(ex, undefined, said)
      }
    },
    undefined,
    { p: at },
  )
  gone()
  if (refused && at === ctx.P && (await editedElsewhere(a, text, files, said, drafts))) return render()
  if (ok) {
    for (const f of drafts) {
      f.sent = true
      dropRec(f)
    }
    for (const f of FAILED.filter((x) => x.what === said)) dropFailed(f.id) // T438 #7: saved now: the red line about it goes
  }
  render()
}
// T438 #7 (B4): your edit was refused because the input changed in another window (another tab added to it, its voice
// note's words came): when that change only added words after the ones you began from, they go on after yours and it
// is saved; otherwise your words come back in the box with what it says now, and Save puts yours in its place
async function editedElsewhere(
  a: { id: string; mode: 'edit' | 'append'; v: number; base?: string },
  text: string,
  files: { f?: string; name: string; mime: string; size?: number; tr?: string }[],
  said: string,
  drafts: DraftFile[],
) {
  await load()
  const r = byR.get(a.id)
  if (!r) return false
  const wrong = FAILED.filter((x) => x.what === said).at(-1)
  if (a.mode === 'edit' && a.base != null && r.text !== a.base && r.text.startsWith(a.base)) {
    if (wrong) dropFailed(wrong.id)
    const merged = text + r.text.slice(a.base.length)
    const ok = await optimistic([], { op: 'amend', id: a.id, mode: 'edit', v: r.v || 0, text: merged, files }, () => {
      putBack(() => (U.amend = { ...a, v: r.v || 0, base: r.text }), text, drafts)
    })
    if (ok) toast(`${rcode(a.id)} updated with changes from another window`)
    return true
  }
  if (wrong) dropFailed(wrong.id)
  putBack(() => (U.amend = { ...a, v: r.v || 0, base: r.text }), text, drafts)
  toast(`${rcode(a.id)} changed elsewhere. Text restored; save to apply`, null, {
    error: true,
    sticky: true,
  }) // the box's line shows what it says now
  return true
}
export async function sendCorrect() {
  const c = U.correct,
    box = els.text,
    at = ctx.P // B527: the fix goes to this project, wherever you are when it is sent
  if (!c || !box) return
  const right = box.value.replace(/\s+/g, ' ').trim()
  if (!right) return box.focus()
  // B437: the box is empty at once and the input shows the fix; it is saved behind you
  const before = byR.get(c.id)?.text
  box.value = ''
  saveDraft()
  U.correct = null
  getSelection()?.removeAllRanges()
  const gone = standIn(() => {
    const r = byR.get(c.id)
    if (r) r.text = r.text.split(c.wrong).join(right)
  })
  render()
  if (desk()) box.focus({ preventScroll: true })
  const had = await fetch('/api/corrections', { cache: 'no-store' })
    .then((r) => r.json() as Promise<{ wrong?: string; right: string }[]>)
    .then((l) => l.find((x) => x.wrong === c.wrong)) // A3
    .catch(() => undefined)
  const ok = await optimistic(
    [],
    { op: 'correct', id: c.id, wrong: c.wrong, right, v: c.v },
    (ex) => {
      putBack(() => (U.correct = c), right)
      notSaved(ex, undefined, saidOp({ op: 'correct', id: c.id, wrong: c.wrong }))
    },
    undefined,
    { p: at },
  )
  gone()
  if (!ok) return render()
  const run = pushUndo(`Fix “${c.wrong}” → “${right}” in ${rcode(c.id)}`, async () => {
    // A3: Z puts back the words and the spelling
    const r = byR.get(c.id)
    if (r && before != null && r.text !== before) {
      await op({ op: 'amend', id: c.id, mode: 'edit', v: r.v || 0, text: before }, undefined, at)
    }
    await setFix(had ? { wrong: c.wrong, right: had.right } : { wrong: c.wrong })
    toast(`Put back “${c.wrong}” in ${c.id}${had ? '' : ', and forgot the spelling'}`)
  })
  toast(`Fixed ${c.id}. Voice notes will use “${right}”`, run)
  render()
}
// The answer is an ordinary reply on the item: one line per pick. What you wrote in the box for this item goes with it.
export async function sendChoice(n: number) {
  const labels = U.choiceLabels[n] || [],
    picked = U.choice?.n === n ? [...U.choice.picked].sort((a, c) => a - c) : []
  if (!picked.length) return
  // T438 #5 (A17, C11): answered again: the agent is told which answer this replaces
  const x = U.reask ? byN.get(n)?.thread.find((m) => m.id === U.reask) : undefined,
    was = x ? answerOf(byN.get(n)?.thread || [], x, n) || [] : []
  const picks =
    picked.map((i) => '✓ ' + labels[i]).join('\n') +
    (was.length ? `\n\nChanged my answer (it was: ${was.join(', ')})` : '')
  const withBox = scopeN() === n && !U.amend && !U.correct && !docOpen(),
    note = withBox ? (els.text?.value ?? '').trim() : '',
    files = withBox ? U.files : []
  if (withBox && R_STATE.rec) return finishRec(true) // B331: a voice note still recording goes with the answer: stop it, then send both (send takes the ticked choices)
  try {
    const rid: string | null = null
    // B326: an answer goes out like anything you write: at once on the screen, kept and sent again until Taska has it
    outboxPush({ text: picks + (note ? '\n\n' + note : ''), files, scope: code(n), quiet: true, kind: 'answer' })
    answersGoing()
    if (note || files.length) {
      if (els.text) els.text.value = ''
      U.files = []
      saveDraft()
    }
    flushOutbox()
    const said = `Answered ${code(n)}${note || files.length ? ' with your note' : ''}` // B155; T438 #1: the card says when it is in Taska
    U.choice = null
    U.reask = null // F428: answered again: the card shows the new answer
    keepChoice()
    if (U.peek === n) advance(n, said)
    else if (U.open !== n) {
      toast(said) // T438 #11: with the card in sight, the card says it
      showSent(rid, code(n))
    }
    if (desk() && U.go && U.open === n && U.go.list.includes(n)) advanceDesk(n, 'Answered')
    render()
  } catch {
    /* save said why */
  }
}
