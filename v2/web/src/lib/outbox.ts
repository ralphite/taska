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
} from './state'
import { toast } from './toast'
import { JSON_POST, load, notSaved, op, pushUndo, forget, save, sendLog, change, type OpAnswer } from './data'
import { tickedDoc, ticksDone, ticksGoing, ticksOf, tickWords } from './doctick'
import { actLog } from './actlog'
import type { Doc } from './types'
import { setFix } from './settings'
import { draftName, draftStore, goDraft, keepChoice, markSent, saveDraft, setDraft, draftMarks } from './drafts'
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
  if (desk() && D.compose) toast('Sent', job.undo) // the New input page has no line under the box
  box.value = ''
  U.files = []
  saveDraft()
  if (n && U.ask === n) {
    U.ask = null
    if (byN.get(n)?.status === 'review') change(n, 'status', 'doing', { said: 'is back in progress' })
  } // Not yet, with its reason (T274 #14)
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
    md = tickedDoc(doc),
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
  void saveTicks(doc.d, sent, md)
}
async function saveTicks(d: number, sent: Record<string, string>, md: string) {
  ticksGoing(d, sent) // still shown ticked; the box no longer says they wait
  render()
  try {
    await op({ op: 'doc', d, md })
    ticksDone(d, sent, true)
  } catch (ex) {
    ticksDone(d, sent, false) // they wait again, as you ticked them
    notSaved(ex, () => saveTicks(d, sent, md), `your choices in D${d}`)
  }
  renderDoc()
  bump('composer')
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
  const run = pushUndo(`Send to ${draftName(jobKey(job))}`, () => unsend(job, run))
  job.undo = run
  U.sentJobs = [...U.sentJobs, job]
  setTimeout(() => {
    forget(run)
    job.undo = undefined
    U.sentJobs = U.sentJobs.filter((j) => j !== job)
    bump('feedback')
  }, UNSEND_MS)
}
async function unsend(job: Job, run: () => unknown) {
  const key = jobKey(job),
    i = U.outbox.indexOf(job)
  if (i >= 0 && !job.sending) {
    U.outbox.splice(i, 1)
    dropJob(job)
  } else {
    for (let t = 0; t < 100 && U.outbox.includes(job); t++) await new Promise((r) => setTimeout(r, 100)) // on its way: wait for Taska's answer
    const r = job.rid && byR.get(job.rid)
    if (!job.rid || U.outbox.includes(job)) {
      toast('It could not be taken back: try again', null, { error: true })
      return false
    }
    if (r && (r.acked || model.S.org.busy === r.id || r.org)) {
      toast(`${job.rid} is already with ${r.org ? 'the organizer' : 'your agent'}: delete it from Inputs`)
      return true
    }
    try {
      await save({ op: 'delete', id: job.rid }, run)
    } catch {
      return false
    }
    if (U.lastSent === job.rid) U.lastSent = null
  }
  const files = job.files.filter((f) => !f.failed).map((f) => Object.assign(f, { sent: false, job: null }))
  const was = key === U.draftKey ? (els.text?.value ?? '') : String(draftStore()[key] || ''),
    wasFiles = key === U.draftKey ? U.files : U.parked[key] || []
  setDraft(key, was.trim() ? job.text + '\n\n' + was : job.text, [...files, ...wasFiles])
  draftMarks()
  render()
  if (key === U.draftKey) els.text?.focus({ preventScroll: true })
  toast(
    key === U.draftKey
      ? 'Not sent: your words are back in the box'
      : `Not sent: your words are back in the box of ${draftName(key)}`,
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
    sendLog('resend', `${back.length} input(s) sent before a reload or a closed tab, going out again now`)
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
        if (here) U.lastSent = job.quiet ? null : job.rid
        U.outbox.shift()
        dropJob(job)
        if (here) sent = [job.rid, job.scope]
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

export async function sendAmend() {
  const a = U.amend,
    box = els.text
  if (!a || !box) return
  const text = box.value.trim(),
    drafts = [...U.files]
  if (a.mode === 'dc') {
    // B258
    if (!text && !drafts.length && !dcFind(a.d, a.id)?.files?.length)
      return toast('Write something, or delete the comment instead')
    await Promise.all(drafts.map((f) => f.done)) // T257 #3: what you added goes along once uploaded
    const files = drafts
      .filter((f) => f.f && !f.failed)
      .map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size, tr: f.tr }))
    try {
      await save({ op: 'dcedit', d: a.d, id: a.id, text, ...(files.length ? { files } : {}) })
    } catch {
      return
    }
    box.value = ''
    U.files = []
    saveDraft()
    U.amend = null
    renderDoc()
    render()
    toast('Comment updated')
    if (desk()) box.focus({ preventScroll: true })
    return
  }
  if (!text && !drafts.length) return box.focus()
  await Promise.all(drafts.map((f) => f.done)) // a voice note or screenshot goes along once uploaded (B168)
  const files = drafts
    .filter((f) => f.f && !f.failed)
    .map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size, tr: f.tr }))
  try {
    const d = await (
      await fetch(ctx.P + 'api/op', JSON_POST({ op: 'amend', id: a.id, mode: a.mode, v: a.v, text, files }))
    ).json()
    if (!d.ok) return toast((d.res || []).find((x: string) => x.startsWith('err')) || d.error || 'Not saved')
    for (const f of drafts) {
      f.sent = true
      dropRec(f)
    }
    box.value = ''
    U.files = []
    saveDraft()
    U.amend = null
    await load()
    toast(a.mode === 'edit' ? `${rcode(a.id)} updated` : `Added to ${rcode(a.id)}`)
    render()
    if (desk()) box.focus({ preventScroll: true })
  } catch {
    toast('Connection lost. Your words are still in the box; try again.')
  }
}
export async function sendCorrect() {
  const c = U.correct,
    box = els.text
  if (!c || !box) return
  const right = box.value.replace(/\s+/g, ' ').trim()
  if (!right) return box.focus()
  try {
    const before = byR.get(c.id)?.text,
      had = (
        (await (await fetch('/api/corrections', { cache: 'no-store' })).json()) as { wrong?: string; right: string }[]
      ).find((x) => x.wrong === c.wrong) // A3
    const d = await (
      await fetch(ctx.P + 'api/op', JSON_POST({ op: 'correct', id: c.id, wrong: c.wrong, right, v: c.v }))
    ).json()
    if (!d.ok) return toast((d.res || []).find((x: string) => x.startsWith('err')) || d.error || 'Not saved')
    box.value = ''
    saveDraft()
    U.correct = null
    getSelection()?.removeAllRanges()
    await load()
    const run = pushUndo(`Fix “${c.wrong}” → “${right}” in ${rcode(c.id)}`, async () => {
      // A3: Z puts back the words and the spelling
      const r = byR.get(c.id)
      if (r && before != null && r.text !== before) {
        await op({ op: 'amend', id: c.id, mode: 'edit', v: r.v || 0, text: before })
      }
      await setFix(had ? { wrong: c.wrong, right: had.right } : { wrong: c.wrong })
      toast(`Put back “${c.wrong}” in ${c.id}${had ? '' : ', and forgot the spelling'}`)
    })
    toast(`Fixed ${c.id}. Voice notes will write “${right}” from now on`, run)
    render()
    if (desk()) box.focus({ preventScroll: true })
  } catch {
    toast('Connection lost. Your words are still in the box; try again.')
  }
}
// The answer is an ordinary reply on the item: one line per pick. What you wrote in the box for this item goes with it.
export async function sendChoice(n: number) {
  const labels = U.choiceLabels[n] || [],
    picked = U.choice?.n === n ? [...U.choice.picked].sort((a, c) => a - c) : []
  if (!picked.length) return
  const picks = picked.map((i) => '✓ ' + labels[i]).join('\n')
  const withBox = scopeN() === n && !U.amend && !U.correct && !docOpen(),
    note = withBox ? (els.text?.value ?? '').trim() : '',
    files = withBox ? U.files : []
  if (withBox && R_STATE.rec) return finishRec(true) // B331: a voice note still recording goes with the answer: stop it, then send both (send takes the ticked choices)
  try {
    const rid: string | null = null
    // B326: an answer goes out like anything you write: at once on the screen, kept and sent again until Taska has it
    outboxPush({ text: picks + (note ? '\n\n' + note : ''), files, scope: code(n), quiet: true, kind: 'answer' })
    if (note || files.length) {
      if (els.text) els.text.value = ''
      U.files = []
      saveDraft()
    }
    flushOutbox()
    const said = `Answer sent to ${code(n)}${note || files.length ? ' with your note' : ''}` // B155
    U.choice = null
    keepChoice()
    if (U.peek === n) advance(n, said)
    else {
      toast(said)
      showSent(rid, code(n))
    }
    if (desk() && U.go && U.open === n && U.go.list.includes(n)) advanceDesk(n, 'Answered')
    render()
  } catch {
    /* save said why */
  }
}
