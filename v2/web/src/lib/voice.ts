// Voice notes (B165, T101, F184, F208). Recording is in the box (the mic, V, Shift+V, Alt+V), on a document's
// passage (a voice comment) and in the document editor (the words go where the caret is). A note is in the box at
// once and the box is yours; its words come when they come. From the moment it stops it is kept in this browser
// (IndexedDB) until it is sent, so a restart or a closed tab never loses it.
import {
  dcAll,
  R_STATE as R,
  U,
  bump,
  byN,
  byR,
  clock,
  code,
  ctx,
  desk,
  docById,
  docOpen,
  els,
  liveN,
  model,
  parseRef,
  scopeN,
  sleep,
  type DraftFile,
} from './state'
import { toast } from './toast'
import { JSON_POST, net, pushUndo, save } from './data'
import { draftName, draftStore, goDraft, kept, saveDraft } from './drafts'
import { docKey, renderDoc } from './docs'
import { plainQuote } from './markdown'
import { send, outboxPush, flushOutbox } from './outbox'
import { standalone } from './notices'

export const canRecord = () =>
  !!(
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  )

// A voice note as the microphone hears it (B182): no echo cancelling, noise suppression or automatic gain.
const MIC = { stream: null as MediaStream | null, kept: 'none' }
// how the kept stream was when a new one was asked for (B333: for the log)
const keptState = (s: MediaStream | null) => {
  const t = s?.getAudioTracks()[0]
  return !t ? 'none' : t.readyState !== 'live' ? 'ended' : t.muted ? 'muted' : 'live'
}
// B333: iPhone mutes the kept stream while Taska is in the background or another app has the microphone; it comes
// back by itself. Asking for a new one then is refused until Taska is opened again, so wait for it first.
const unmuted = (s: MediaStream, ms: number) =>
  new Promise<boolean>((done) => {
    const t = s.getAudioTracks()[0]
    if (!t || t.readyState !== 'live') return done(false)
    if (!t.muted) return done(true)
    const back = () => {
      clearTimeout(timer)
      done(true)
    }
    const timer = setTimeout(() => {
      t.removeEventListener('unmute', back)
      done(!t.muted)
    }, ms)
    t.addEventListener('unmute', back, { once: true })
  })
async function micStream() {
  MIC.kept = keptState(MIC.stream)
  if (MIC.stream && MIC.kept === 'live') return MIC.stream // B217
  if (MIC.stream && MIC.kept === 'muted' && (await unmuted(MIC.stream, 1500))) return MIC.stream
  const old = MIC.stream
  const md = navigator.mediaDevices
  let s: MediaStream
  try {
    try {
      s = await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    } catch (e) {
      if ((e as Error)?.name === 'NotAllowedError' || (e as Error)?.name === 'SecurityError') throw e
      s = await md.getUserMedia({ audio: true })
    }
  } catch (e) {
    if (old && keptState(old) !== 'ended') return old // refused, but the kept one still lives: record with it
    throw e
  }
  if (old && old !== s) old.getTracks().forEach((t) => t.stop())
  MIC.stream = standalone() ? s : null
  return s
}
const micDone = (s: MediaStream | null) => {
  if (s && s !== MIC.stream) s.getTracks().forEach((t) => t.stop())
  else if (document.visibilityState === 'hidden') setTimeout(micRelease)
}
export function micRelease() {
  if (!MIC.stream || R.rec || DV.rec) return
  MIC.stream.getTracks().forEach((t) => t.stop())
  MIC.stream = null
}
// T256: why the microphone did not start, and what to do
function micError(e: unknown) {
  const name = (e as Error)?.name || ''
  void fetch(
    ctx.P + 'api/miclog',
    JSON_POST({
      name,
      message: String((e as Error)?.message || e || ''),
      where: 'start',
      standalone: String(standalone()),
      kept: MIC.kept,
      secure: String(window.isSecureContext),
      ua: navigator.userAgent,
    }),
  ).catch(() => {}) // B288
  if (!window.isSecureContext) return 'The microphone only works on a secure address: open Taska from its https link.'
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return standalone()
      ? 'iPhone stopped letting Taska use the microphone. Close Taska completely (swipe it away) and open it again. Still no? Settings › Apps › Safari › Microphone › Allow.'
      : 'Taska may not use the microphone. Allow it for this site (Safari: aA › Website Settings › Microphone), then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found on this device.'
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'The microphone is busy (a call, another app or tab). Stop that, then try again.'
  return `The microphone did not start (${name || 'unknown error'}). Try again.`
}
// B166: why the mic can't record here, in the line above the box (no popup)
export function voiceWhy() {
  if (window.isSecureContext) return toast('This browser can’t record voice notes')
  U.note = 'voice-why'
  bump('feedback')
}

export async function startRec() {
  if (!canRecord()) return voiceWhy() // B166
  // B1: the note belongs where you started it, whatever is open when it stops
  const key = U.draftKey,
    scope = scopeN() ? code(scopeN()) : null,
    typing = document.activeElement === els.text
  try {
    R.stream = await micStream()
  } catch (e) {
    return toast(micError(e), null, { error: true })
  }
  R.chunks = []
  R.levels = []
  R.typing = typing
  R.key = key
  R.scope = scope
  if (R.typing) els.text?.blur()
  R.muted = false // B277: the phone took the microphone away mid-note
  for (const t of R.stream.getAudioTracks()) {
    t.onmute = () => {
      R.muted = true
    }
    t.onended = () => {
      R.muted = true
    }
  }
  const rec = new MediaRecorder(R.stream)
  R.rec = rec
  rec.ondataavailable = (e) => {
    if (e.data.size) R.chunks.push(e.data)
  }
  rec.start(1000)
  R.t0 = Date.now()
  try {
    const ac = new AudioContext()
    R.ctx = ac
    const an = ac.createAnalyser()
    an.fftSize = 512
    ac.createMediaStreamSource(R.stream).connect(an)
    const buf = new Uint8Array(an.fftSize)
    R.meter = () => {
      an.getByteTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += (v - 128) ** 2
      return Math.min(1, Math.sqrt(sum / buf.length) / 40)
    }
  } catch {
    R.meter = () => 0.2
  }
  R.tick = window.setInterval(() => {
    R.levels.push(R.meter())
    if (R.levels.length > 40) R.levels.shift()
    bump('rec')
  }, 100)
  bump()
}
function stopRec(): Promise<Blob | null> {
  return new Promise((done) => {
    const rec = R.rec
    if (!rec) return done(null)
    rec.onstop = () => done(new Blob(R.chunks, { type: rec.mimeType || 'audio/webm' }))
    rec.stop()
    if (R.muted) {
      R.muted = false
      if (MIC.stream) {
        MIC.stream.getTracks().forEach((t) => t.stop())
        MIC.stream = null
      }
      toast('The phone muted the microphone during this note: what you said after that was not recorded', null, {
        error: true,
      })
    }
    clearInterval(R.tick)
    micDone(R.stream)
    void R.ctx?.close()
    R.rec = null
    R.from = null
    R.levels = []
    bump()
    if (R.typing) {
      R.typing = false
      els.text?.focus()
    } // you were typing when you started: go on typing
  })
}
export async function finishRec(
  andSend: boolean,
  keptRec?: { blob: Blob; ms: number; key: string | null; scope: string | null; vc: typeof R.vc },
) {
  const key = keptRec ? keptRec.key : (R.key ?? U.draftKey),
    scope = keptRec ? keptRec.scope : R.key ? R.scope : scopeN() ? code(scopeN()) : null
  const vc = keptRec ? keptRec.vc : R.vc
  R.vc = null
  const ms = keptRec?.ms ?? Date.now() - R.t0,
    blob = keptRec?.blob ?? (await stopRec())
  if (!blob) return
  if (ms < 800 || !blob.size) {
    void fetch(
      ctx.P + 'api/miclog',
      JSON_POST({
        name: blob.size ? 'short' : 'empty',
        message: `${ms} ms, ${blob.size} bytes, ${blob.type}`,
        where: 'stop',
        standalone: String(standalone()),
        secure: String(window.isSecureContext),
        ua: navigator.userAgent,
      }),
    ).catch(() => {})
    return toast(
      blob.size
        ? 'Too short, discarded'
        : 'Nothing was recorded: the microphone gave no sound. Try again, or check Settings › Apps › Safari › Microphone',
    ) // B288
  }
  const label = vc && vcQuote(vc, key) // F184: the quote first, then its words
  if (vc && U.doc === vc.d && vc.key) {
    U.docQuote = { key: vc.key, text: vc.quote }
    U.docSel = new Set()
    U.docReply = null
  } // T274 #3
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const f = voiceFile({
    name: `voice ${clock(ms).replace(':', '-')}.${ext}`,
    mime: blob.type || 'audio/webm',
    ms,
    blob,
    at: (els.text?.value ?? '').length,
    key,
    scope,
    ...(label ? { vc: label } : {}),
  })
  if (key && key !== U.draftKey) {
    // B1, B185: you moved on while recording: the note goes into the box where you started it
    ;(U.parked[key] ||= []).push(f)
    bump('composer')
    if (andSend && (key === 'new' || key === 'rule' || /^[A-Z]\d+$/.test(key))) sendParked(key)
    else
      toast(`The voice note is in the box for ${draftName(key)}, where you started it`, () => goDraft(key), {
        label: 'Go there',
      })
  } else {
    U.files.push(f)
    bump('composer')
    if (andSend) send()
    else if (desk() && !keptRec) els.text?.focus({ preventScroll: true }) // A1
  }
  keepRec(f).then(() => hear(f)) // kept before anything goes over the network
}
export async function cancelRec() {
  // B149: discarding can be undone for a few seconds
  const ms = Date.now() - R.t0,
    key = R.key,
    scope = R.scope,
    vc = R.vc,
    blob = await stopRec()
  R.vc = null
  bump('vc')
  if (!blob || ms < 800 || !blob.size) return
  toast('Recording discarded', () => finishRec(false, { blob, ms, key, scope, vc }))
}
function sendParked(key: string) {
  const files = U.parked[key] || [],
    text = (draftStore()[key] || '').trim()
  delete U.parked[key]
  draftStore((all) => {
    delete all[key]
  })
  outboxPush({ text, files, scope: /^[A-Z]\d+$/.test(key) ? key : null, from: key === 'rule' ? 'rules' : null })
  toast(`Sent to ${draftName(key)}, where you started the voice note`)
  bump()
  flushOutbox()
}

// ---------------------------------------------------------------- kept in this browser (T101)

const VDB = {
  db: null as Promise<IDBDatabase> | null,
  open() {
    return (VDB.db ||= new Promise((ok, no) => {
      const r = indexedDB.open('taska-voice', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' })
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    }))
  },
  async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
    try {
      const db = await VDB.open()
      return await new Promise<T>((ok, no) => {
        const t = db.transaction('notes', mode),
          q = fn(t.objectStore('notes'))
        t.oncomplete = () => ok(q.result)
        t.onerror = t.onabort = () => no(t.error)
      })
    } catch {
      return null
    } // no storage here (a private window...): voice notes still work, they are just not kept
  },
  put: (rec: unknown) => VDB.run('readwrite', (s) => s.put(rec)),
  del: (id: string) => VDB.run('readwrite', (s) => s.delete(id)),
  all: () => VDB.run('readonly', (s) => s.getAll()).then((a) => (a || []) as VoiceRecord[]),
}
interface VoiceRecord {
  id: string
  project: string
  key: string | null
  scope: string | null
  name: string
  mime: string
  ms: number
  t: number
  data: ArrayBuffer
  f: string | null
  tr: string | null
  tr_error: string
  doubts: DraftFile['doubts']
  added: string | null
  job: { id: string; text: string } | null
  vc: string | null
}
function voiceFile(o: Partial<DraftFile> & { name: string; mime: string }): DraftFile {
  const f: DraftFile = {
    transcribing: true,
    t: Date.now(),
    rid: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    done: Promise.resolve(),
    ...o,
  }
  f.done = new Promise<void>((r) => {
    f.settle = r
  }) // uploaded: all that sending waits for (B165)
  holdRec(f)
  return f
}
export async function keepRec(f: DraftFile) {
  // what is known about a voice note, kept with its audio
  if (!f.rid || f.gone || f.sent || !f.blob) return
  try {
    f.data ||= await f.blob.arrayBuffer()
  } catch {
    return
  }
  if (f.gone || f.sent) return // let go of meanwhile: it must not come back
  await VDB.put({
    id: f.rid,
    project: ctx.HERE,
    key: f.key,
    scope: f.scope,
    name: f.name,
    mime: f.mime,
    ms: f.ms,
    t: f.t,
    data: f.data,
    f: f.f || null,
    tr: f.transcribing ? null : f.tr || '',
    tr_error: f.tr_error || '',
    doubts: f.doubts || [],
    added: f.trAdded || null,
    job: f.job || null,
    vc: f.vc || null,
  })
}
export function dropRec(f: DraftFile, sent = true) {
  // sent, or removed from the box: this browser lets it go
  if (!f.rid) return
  if (sent) f.sent = true
  void VDB.del(f.rid)
  f.release?.()
  f.release = f.held = null
}
export function holdRec(f: DraftFile) {
  // while this page has the voice note, another tab of the project leaves it alone
  if (!f.rid || f.held || !navigator.locks) return
  f.held = navigator.locks
    .request(
      'taska-voice-' + f.rid,
      () =>
        new Promise<void>((r) => {
          f.release = r
          if (f.sent || f.gone) r()
        }),
    )
    .catch(() => {})
}
interface TrAnswer {
  done: boolean
  tr: string
  tr_error: string
  doubts?: DraftFile['doubts']
  more?: boolean
}
// Upload a voice note, then wait for its words, in the background (B165), tried again with growing pauses (T101).
export async function hear(f: DraftFile) {
  if (f.loop) return
  f.loop = true
  const scope = f.scope ? '&scope=' + encodeURIComponent(f.scope) : ''
  let d: TrAnswer | null = null
  if (f.f) f.settle?.() // uploaded before (put back after a reload): sending does not wait for its words
  for (let n = 0, tries = 0, waits = 0; !f.gone; n++) {
    try {
      if (!f.f) {
        const r = await fetch(`${ctx.P}api/file?name=${encodeURIComponent(f.name)}&transcribe=1${scope}`, {
          method: 'POST',
          headers: { 'Content-Type': f.mime },
          body: f.blob,
        })
        if (r.status === 400 || r.status === 413) {
          f.failed = true
          break
        } // refused (too big): trying again will not help
        if (!r.ok) throw new Error()
        const u = await r.json()
        Object.assign(f, { f: u.f, size: u.size })
        void keepRec(f)
        f.settle?.()
        bump('composer')
      }
      const r = await fetch(
        `${ctx.P}api/transcript?f=${encodeURIComponent(f.f as string)}${scope}${tries ? '&again=1' : ''}`,
        { method: 'POST' },
      )
      if (!r.ok) throw new Error()
      d = (await r.json()) as TrAnswer
      if (d.tr_error === 'no such voice note') {
        f.f = undefined
        throw new Error()
      } // the audio is not there any more: up again
      if (!d.done && ++waits < 20) continue // still working: the server answers after 45 s for another ask
      if (d.done && d.tr_error && ++tries < 4) throw new Error() // the models had trouble: a few more tries
      break
    } catch {
      if (f.gone) break
      f.retrying = true
      bump('composer', 'feedback')
      await sleep(Math.min(30000, 2000 * 2 ** Math.min(n, 4)))
    }
  }
  f.loop = false
  if (f.gone) return // removed from the box meanwhile; its Undo starts it again
  f.transcribing = f.retrying = false
  f.settle?.()
  if (f.failed) {
    for (const list of [U.files, ...Object.values(U.parked || {})]) {
      const i = list.indexOf(f)
      if (i >= 0) list.splice(i, 1)
    }
    dropRec(f, false)
    bump('composer')
    return toast('Could not upload the recording')
  }
  Object.assign(f, {
    tr: d?.tr || '',
    tr_error: d?.tr_error || (d?.done ? '' : 'no answer'),
    doubts: d?.doubts || [],
    more: !!d?.more,
  })
  placeWords(f)
  void keepRec(f)
  bump('composer', 'feedback')
  if (f.more) hearMore(f)
}
// The strong model ran out of time on this note: its fuller words may come within a few minutes.
async function hearMore(f: DraftFile) {
  for (let n = 0, t0 = Date.now(); f.more && !f.gone && Date.now() - t0 < 5 * 60000; n++) {
    let d: TrAnswer | null
    try {
      d = await net<TrAnswer>(
        `${ctx.P}api/transcript?f=${encodeURIComponent(f.f as string)}&more=1`,
        { method: 'POST' },
        60000,
      )
    } catch {
      await sleep(Math.min(30000, 2000 * 2 ** Math.min(n, 4)))
      continue
    }
    if (d.more) continue
    f.more = false
    if (d.tr && d.tr !== f.tr && !f.sent) fullerWords(f, d.tr)
    if (!f.sent) {
      void keepRec(f)
      bump('composer')
    }
    return
  }
  f.more = false
  bump('composer')
}
function fullerWords(f: DraftFile, words: string) {
  const key = U.files.includes(f) ? U.draftKey : Object.keys(U.parked || {}).find((k) => U.parked[k].includes(f))
  if (!key) return
  const was = f.trAdded || f.tr,
    put = (v: string) => (was && v.includes(was) ? v.replace(was, words) : (v.trim() ? v.trimEnd() + '\n' : '') + words)
  if (key === U.draftKey && els.text) {
    els.text.value = put(els.text.value)
    saveDraft()
  } else
    draftStore((all) => {
      all[key] = put(all[key] || '')
    })
  Object.assign(f, { tr: words, trAdded: words, doubts: [] })
  toast('The fuller words of the voice note are in')
}
function addWords(key: string, words: string) {
  // into the box, or into the draft of the target it waits for
  if (key === U.draftKey && els.text) {
    const t = els.text
    t.value = (t.value.trim() ? t.value.trimEnd() + '\n' : '') + words
    saveDraft()
  } else
    draftStore((all) => {
      all[key] = (all[key]?.trim() ? all[key].trimEnd() + '\n' : '') + words
    })
}
export function placeWords(f: DraftFile) {
  // B165: a voice note's words go where you recorded it, around what you typed since
  if (!desk() && f.doubts?.some((x) => x.alt)) U.boxView = true // F186: the words to check show in the box on the phone
  const key = U.files.includes(f) ? U.draftKey : Object.keys(U.parked || {}).find((k) => U.parked[k].includes(f))
  if (key && f.tr && !f.trAdded) {
    if (U.files.includes(f) && els.text) {
      const t = els.text,
        q = f.vc ? vcLineEnd(t.value, f.vc) : -1 // F184: under its quote, wherever that is now
      const at = q >= 0 ? q : Math.min(f.at ?? t.value.length, t.value.length),
        before = t.value.slice(0, at),
        after = t.value.slice(at)
      const caretHere = t.selectionStart === at && t.selectionEnd === at
      t.setRangeText(
        (before.trim() && !before.endsWith('\n') ? '\n' : '') +
          f.tr +
          (after.trim() && !after.startsWith('\n') ? '\n' : ''),
        at,
        at,
        caretHere ? 'end' : 'preserve',
      )
      saveDraft()
    } else addWords(key, f.tr) // its box shows another target now
    f.trAdded = f.tr
  } else if (key && !f.tr)
    toast(
      f.tr_error
        ? 'Transcription failed. The audio is kept and can be sent as is.'
        : 'No words heard. The audio is kept and can be sent as is.',
    )
  else if (!key && f.sent && !f.tr)
    toast(f.tr_error ? 'Transcription failed. The audio was sent as is.' : 'No words heard. The audio was sent as is.')
}
export const unmarked = (s: string) => s.replace(/\s*[(（][?？][)）]/g, '') // without the model's "(?)"
// Voice notes this browser kept that never went out come back into the box they were recorded in.
export async function restoreVoice() {
  const sent = new Set(model.S.inputs.flatMap((r) => r.files.map((x) => x.f)))
  const here = new Set(
    [...U.files, ...Object.values(U.parked).flat(), ...U.outbox.flatMap((q) => q.files)].map((f) => f.rid),
  )
  const jobs = new Set<string>(),
    back: string[] = []
  for (const r of (await VDB.all()).sort((a, b) => a.t - b.t)) {
    if (r.project !== ctx.HERE || here.has(r.id)) continue
    if (r.f && sent.has(r.f)) {
      void VDB.del(r.id)
      continue
    } // it went out already
    if (navigator.locks && !(await navigator.locks.request('taska-voice-' + r.id, { ifAvailable: true }, (l) => !!l)))
      continue // another tab has it
    // B185: back into the box it was recorded in, never the one open now
    const n = /^[A-Z]\d+$/.test(r.key || '') ? parseRef(r.key) : 0,
      inp = /^(edit|append|correct) (r\d+)$/.exec(r.key || ''),
      dm = /^doc (\d+)$/.exec(r.key || '')
    const key = n
      ? byN.has(n)
        ? code(liveN(n))
        : 'new'
      : r.key === 'rule' || (inp && byR.has(inp[2])) || (dm && docById(Number(dm[1])))
        ? (r.key as string)
        : 'new'
    const f = voiceFile({
      rid: r.id,
      name: r.name,
      mime: r.mime,
      ms: r.ms,
      t: r.t,
      data: r.data,
      blob: new Blob([r.data], { type: r.mime }),
      key,
      scope: /^[A-Z]\d+$/.test(key) ? key : null,
      f: r.f || undefined,
      transcribing: r.tr == null && !r.tr_error,
      tr: r.tr || '',
      tr_error: r.tr_error || '',
      doubts: r.doubts || [],
      trAdded: r.added || undefined,
      ...(r.vc ? { vc: r.vc } : {}),
    })
    if (key === U.draftKey) U.files.push(f)
    else (U.parked[key] ||= []).push(f)
    if (r.job && !jobs.has(r.job.id)) {
      jobs.add(r.job.id)
      if (r.job.text) addWords(key, r.job.text)
    } // what was sent with it
    if (f.transcribing) hear(f)
    else {
      f.settle?.()
      placeWords(f)
    }
    void keepRec(f)
    back.push(key)
  }
  if (!back.length) return
  bump('composer')
  const away = back.find((k) => k !== U.draftKey)
  const say = `${back.length === 1 ? 'A voice note that did not go out is' : back.length + ' voice notes that did not go out are'} back in the box${away ? ` for ${draftName(away)}` : ''}`
  if (away) toast(say, () => goDraft(away), { label: 'Go there' })
  else toast(say)
}

// ---------------------------------------------------------------- doubts (F186)

// What is in the text now, at one place of a doubt
const dForm = (x: NonNullable<DraftFile['doubts']>[number], o: { was: string; alt: string }) =>
  x.pick === 'alt' ? o.alt : o.was
export interface Spot {
  s: number
  e: number
  f: DraftFile
  i: number
  k: number
  x: NonNullable<DraftFile['doubts']>[number]
  o: { was: string; alt: string }
}
export function draftSpots(text: string): Spot[] {
  // -> the places of each doubt in the text now, in order, not overlapping
  const out: Spot[] = []
  U.files.forEach((f, i) =>
    (f.doubts || []).forEach((x, k) => {
      for (const o of [x, ...(x.also || [])]) {
        const cur = dForm(x, o)
        for (let at = cur ? text.indexOf(cur) : -1; at >= 0; at = text.indexOf(cur, at + cur.length))
          out.push({ s: at, e: at + cur.length, f, i, k, x, o })
      }
    }),
  )
  out.sort((a, b) => a.s - b.s)
  return out.filter((p, j) => !out.slice(0, j).some((q) => q.e > p.s))
}
export function doubtPick(f: DraftFile, x: NonNullable<DraftFile['doubts']>[number], side: 'was' | 'alt') {
  // -> true if the text changed
  const t = els.text
  if (!t) return false
  const from = x.pick === 'alt' ? 'alt' : 'was'
  let text = t.value,
    vAt = f.trAdded ? text.indexOf(f.trAdded) : -1,
    vLen = f.trAdded?.length || 0,
    done = 0
  if (from !== side)
    for (const o of [x, ...(x.also || [])]) {
      const a = o[from],
        b = o[side]
      for (let at = a ? text.indexOf(a) : -1; at >= 0; at = text.indexOf(a, at + b.length)) {
        text = text.slice(0, at) + b + text.slice(at + a.length)
        done++
        if (vAt >= 0 && at >= vAt && at < vAt + vLen) vLen += b.length - a.length
        else if (vAt >= 0 && at < vAt) vAt += b.length - a.length
      }
    }
  if (done) {
    t.value = text
    if (vAt >= 0) f.trAdded = text.slice(vAt, vAt + vLen)
    saveDraft()
  }
  x.pick = side
  void keepRec(f)
  bump('composer', 'detail')
  return !!done
}

// ---------------------------------------------------------------- voice comments on a document (F184)

// A small button by the selection starts recording at once; the same button stops it. The quote ("> "...") and the
// voice note go into the box after what is there, its words under its quote when they come, and nothing is sent:
// select, speak, select, speak..., then one Send posts each quote's words as a comment on its passage.
export const VC_MARK = /^> “(.+)”[ \t]*$/
export const vcCount = (text: string) => text.split('\n').filter((l) => VC_MARK.test(l)).length
function vcLineEnd(text: string, label: string) {
  // where a quote's words go: right under its line, or -1
  const lines = text.split('\n')
  let at = 0
  for (const l of lines) {
    at += l.length + 1
    if (VC_MARK.exec(l)?.[1] === label) return Math.min(at, text.length)
  }
  return -1
}
function vcQuote(vc: NonNullable<typeof R.vc>, key: string | null) {
  // puts the quote line into the box the note belongs to -> its label
  let label = plainQuote(vc.quote).replace(/\s+/g, ' ')
  if (label.length > 300) label = label.slice(0, 300) + '…'
  const add = (v: string) => (v.trim() ? v.trimEnd() + '\n\n' : '') + `> “${label}”\n`
  if ((!key || key === U.draftKey) && els.text) {
    els.text.value = add(els.text.value)
    saveDraft()
  } else
    draftStore((all) => {
      if (key) all[key] = add(all[key] || '')
    })
  U.vcMarks = [
    ...U.vcMarks.filter((m) => m.label !== label),
    { label, d: vc.d as number, key: vc.key as string, quote: vc.quote },
  ]
  U.docQuote = null
  getSelection()?.removeAllRanges()
  return label
}
// The text selected right now that a voice comment can be about, or null
export function vcSelection(): null | { key: string | null; text: string; range: Range } {
  const sel = getSelection()
  if (U.docCircle || !sel?.rangeCount || sel.isCollapsed) return null
  const text = sel.toString().trim(),
    an = sel.anchorNode,
    node = an?.nodeType === 1 ? (an as Element) : an?.parentElement
  if (text.length < 2 || !node) return null
  if (docOpen()) {
    // a document: the comment goes on that passage (F184)
    const sec = !node.closest('[data-thread]') && node.closest<HTMLElement>('#docBlocks > section[data-key]')
    return sec ? { key: sec.dataset.key || null, text: text.slice(0, 500), range: sel.getRangeAt(0) } : null
  }
  // F199: an item's text and its thread, what you said in Inputs
  if (node.closest('#composer, input, textarea, [contenteditable], button, #vcBar, #toast')) return null
  return node.closest('#detailBody, #dlgBody, #inputsView')
    ? { key: null, text: text.slice(0, 500), range: sel.getRangeAt(0) }
    : null
}
export const vcScroller = () => (desk() ? els.detailBody : (document.getElementById('dlgBody') as HTMLElement | null))
export async function vcToggle() {
  if (R.vc) return R.rec ? finishRec(!desk() && !U.docType) : undefined // I285: on the phone, stop posts it
  if (R.rec) return
  const s = vcSelection()
  if (!s) return
  R.vc = {
    d: U.doc,
    key: s.key,
    quote: s.text,
    range: s.range.cloneRange(),
    rect: s.range.getBoundingClientRect(),
    top: vcScroller()?.scrollTop || 0,
  }
  await startRec()
  if (!R.rec) R.vc = null
  bump('vc')
}
export async function docSay(key: string, quote?: string) {
  // I285: speak about the paragraph you tapped; stop posts it
  if (R.rec) {
    if (R.vc) await vcToggle()
    return renderDoc()
  } // B300: the same button stops it, and posts
  const d = docById(U.doc),
    blk = d?.blocks.find((x) => x.key === key),
    sec = document.querySelector(`#docBlocks section[data-key="${CSS.escape(key)}"]`)
  if (!sec || !blk) return
  R.vc = {
    d: U.doc,
    key: blk.key,
    quote: (quote || blk.text).slice(0, 500), // B355: one item of a list, or the whole paragraph
    range: null,
    rect: sec.getBoundingClientRect(),
    top: vcScroller()?.scrollTop || 0,
  }
  await startRec()
  if (!R.rec) R.vc = null
  renderDoc()
  bump('vc')
}
// The box as comments: each quote line, the words under it (words above the first quote go with the first).
function vcSegments(text: string, d: NonNullable<ReturnType<typeof docById>>) {
  const segs: { label: string; lines: string[]; key?: string; quote?: string; text?: string }[] = [],
    pre: string[] = []
  for (const l of text.split('\n')) {
    const m = VC_MARK.exec(l)
    if (m) segs.push({ label: m[1], lines: [] })
    else (segs.at(-1)?.lines || pre).push(l)
  }
  if (pre.join('').trim()) segs[0].lines.unshift(...pre, '')
  for (const s of segs) {
    const m = U.vcMarks.find((x) => x.label === s.label && x.d === d.d),
      b = !m && d.blocks.find((b) => plainQuote(b.text).replace(/\s+/g, ' ').includes(s.label.replace(/…$/, '')))
    if (!m && !b)
      return { err: `“${s.label.slice(0, 60)}” is not in D${d.d} any more: change or remove that quote line` }
    Object.assign(s, {
      key: m ? m.key : (b as { key: string }).key,
      quote: m ? m.quote : s.label,
      text: s.lines.join('\n').trim(),
    })
  }
  return { segs }
}
export async function sendVoiceComments() {
  const d = docOpen()
  if (!d || U.vcSending || !els.text) return
  U.vcSending = true
  try {
    const files = [...U.files]
    await Promise.all(files.map((f) => f.done))
    if (files.some((f) => f.transcribing)) toast('Posting as soon as the words of the voice notes are in…')
    for (let i = 0; files.some((f) => f.transcribing) && i < 240; i++) await sleep(500)
    const { segs, err } = vcSegments(els.text.value, d)
    if (err || !segs) return toast(err || 'Nothing to post', null, { error: true })
    const ups = (fs: DraftFile[]) =>
      fs
        .filter((f) => f.f && !f.failed)
        .map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) }))
    const ops = segs.map((s) => ({
      op: 'dc',
      d: d.d,
      key: s.key,
      quote: s.quote,
      text: s.text,
      files: ups(files.filter((f) => f.vc === s.label)),
    }))
    ops.at(-1)?.files.push(...ups(files.filter((f) => !segs.some((s) => s.label === f.vc)))) // other files go with the last
    const sendOps = ops.filter((o) => o.text || o.files.length)
    if (!sendOps.length) return toast('Nothing to post yet: say or write something under a quote')
    const before = new Set(dcAll(d.d).map((c) => c.id))
    await save(sendOps, () => sendVoiceComments())
    for (const f of files) {
      f.sent = true
      dropRec(f)
    }
    els.text.value = ''
    U.files = []
    U.vcMarks = U.vcMarks.filter((m) => m.d !== d.d)
    saveDraft()
    for (const s of segs) if (s.key) U.docThreads.add(s.key)
    Object.assign(U, { docQuote: null, docSel: new Set(), docReply: null })
    renderDoc()
    bump()
    const made = dcAll(d.d)
      .filter((c) => !before.has(c.id) && c.by === 'you')
      .map((c) => c.id)
    toast(
      `Posted ${sendOps.length === 1 ? '1 comment' : sendOps.length + ' comments'} on D${d.d}${made.length && !desk() ? ' · Edit is under it' : ''}`,
      made.length
        ? pushUndo(`Post ${made.length === 1 ? '1 comment' : made.length + ' comments'}`, async () => {
            for (const id of made) await save({ op: 'dcdel', d: d.d, id })
            renderDoc()
            toast('Taken back')
          })
        : null,
    )
  } catch {
    /* save said why */
  } finally {
    U.vcSending = false
  }
}

// ---------------------------------------------------------------- speaking into a document (F208)

// In the editor the microphone puts its words where the caret is: a mark holds the place while you speak and while the
// words are worked out; the words take the mark's place when they come. Save waits for them.
export const DV = {
  rec: null as null | {
    rec: MediaRecorder
    stream: MediaStream
    chunks: Blob[]
    mark: string
    t0: number
    key: string
    scope: string | null
    tick?: number
  },
  n: 0,
  notes: [] as {
    key: string | null
    mark: string
    ms: number
    blob?: Blob
    f?: string
    scope: string | null
    done?: Promise<void>
  }[],
  stopping: null as Promise<void> | null,
}
const dvMark = (i: number) => `⟦🎙 ${i}⟧` // the place the words will go
const docScope = () => {
  const d = docById(U.doc),
    n = d ? liveN(d.n) : U.docNew
  return n ? code(n) : null
}
export async function docRecStart() {
  const t = document.getElementById('docMd') as HTMLTextAreaElement | null
  if (DV.rec || !t) return
  if (R.rec) return toast('A voice note is recording for the box: stop it first')
  if (!canRecord()) return toast('This browser cannot record here')
  let stream: MediaStream
  try {
    stream = await micStream()
  } catch (e) {
    return toast(micError(e), null, { error: true })
  }
  const t2 = document.getElementById('docMd') as HTMLTextAreaElement | null
  if (!t2 || !U.docEdit || DV.rec) {
    micDone(stream)
    return
  } // the editor closed meanwhile
  const mark = dvMark(++DV.n),
    a = t2.selectionStart,
    b = t2.selectionEnd
  t2.focus({ preventScroll: true })
  t2.setRangeText(mark, a, b, 'end') // like dictation: what you selected is what you speak over
  U.docText = t2.value
  const rec = new MediaRecorder(stream),
    chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  rec.start(1000)
  DV.rec = { rec, stream, chunks, mark, t0: Date.now(), key: docKey(), scope: docScope() }
  DV.rec.tick = window.setInterval(() => bump('vc'), 500)
  bump('dialog', 'detail')
}
export function docRecStop(keep = true) {
  const r = DV.rec
  if (!r) return
  DV.rec = null
  clearInterval(r.tick)
  const ms = Date.now() - r.t0,
    note: (typeof DV.notes)[number] = { key: keep ? r.key : null, mark: r.mark, ms, scope: r.scope }
  let stopped = () => {}
  DV.stopping = new Promise<void>((res) => {
    stopped = res
  })
  r.rec.onstop = () => {
    DV.stopping = null
    stopped()
    note.blob = new Blob(r.chunks, { type: r.rec.mimeType || 'audio/webm' })
    if (ms < 800 || !note.blob.size) {
      dvPut(note, '')
      return toast('Too short, discarded')
    }
    DV.notes.push(note)
    note.done = dvHear(note).then((words) => {
      DV.notes.splice(DV.notes.indexOf(note), 1)
      if (words == null) toast('Could not work out the words of the voice note')
      dvPut(note, words || '')
      bump('dialog', 'detail')
    })
    bump('dialog', 'detail')
  }
  r.rec.stop()
  micDone(r.stream)
  bump('dialog', 'detail')
}
async function dvHear(note: (typeof DV.notes)[number]): Promise<string | null> {
  const blob = note.blob as Blob
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const scope = note.scope ? '&scope=' + encodeURIComponent(note.scope) : '',
    t0 = Date.now()
  for (let n = 0, tries = 0, waits = 0; Date.now() - t0 < 10 * 60000;) {
    try {
      if (!note.f) {
        const r = await fetch(
          `${ctx.P}api/file?name=${encodeURIComponent(`voice ${clock(note.ms).replace(':', '-')}.${ext}`)}&transcribe=1${scope}`,
          { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob },
        )
        if (r.status === 400 || r.status === 413) return null
        if (!r.ok) throw new Error()
        note.f = (await r.json()).f
      }
      const r = await fetch(
        `${ctx.P}api/transcript?f=${encodeURIComponent(note.f as string)}${scope}${tries ? '&again=1' : ''}`,
        { method: 'POST' },
      )
      if (!r.ok) throw new Error()
      const d = (await r.json()) as TrAnswer
      if (d.tr_error === 'no such voice note') {
        note.f = undefined
        throw new Error()
      }
      if (!d.done && ++waits < 20) continue
      if (d.done && d.tr_error && ++tries < 4) throw new Error()
      return d.done ? d.tr || '' : null
    } catch {
      await sleep(Math.min(30000, 2000 * 2 ** Math.min(n++, 4)))
    }
  }
  return null
}
function dvPut(note: (typeof DV.notes)[number], words: string) {
  // the words take the mark's place: in the editor, or in the draft it was left as
  const t = document.getElementById('docMd') as HTMLTextAreaElement | null
  if (t && U.docEdit && docKey() === note.key) {
    const at = t.value.indexOf(note.mark)
    if (at < 0) {
      if (words) {
        t.value = t.value.trimEnd() + '\n\n' + words
        toast('The mark was gone: the words are at the end')
      }
      U.docText = t.value
      return
    }
    const end = at + note.mark.length,
      caretAfter = t.selectionStart === end && t.selectionEnd === end
    t.setRangeText(words, at, end, caretAfter ? 'end' : 'preserve')
    U.docText = t.value
    return
  }
  if (!note.key) return
  kept('docs', (all) => {
    const v = all[note.key as string] as string | undefined
    if (v == null) return
    all[note.key as string] = v.includes(note.mark)
      ? v.replace(note.mark, words)
      : words
        ? v.trimEnd() + '\n\n' + words
        : v
  })
  if (words) toast('The words of your voice note are in the draft')
}
export async function docVoiceSettled() {
  // before Save: stop the microphone, wait for the words still coming
  docRecStop()
  const key = docKey(),
    mine = () => DV.notes.filter((v) => v.key === key)
  if (DV.stopping) await DV.stopping
  if (mine().length) {
    toast('Saving once the words of your voice note are in…')
    await Promise.all(mine().map((v) => v.done))
  }
  return U.docEdit && !!document.getElementById('docMd') && docKey() === key
}
export const docMicLabel = () => {
  const key = U.docEdit ? docKey() : null,
    waiting = DV.notes.filter((v) => v.key === key).length
  return {
    on: !!DV.rec,
    text: DV.rec ? `Stop ${clock(Date.now() - DV.rec.t0)}` : 'Speak',
    hint: DV.rec
      ? 'Listening. Your words go where the mark is; you can go on typing.'
      : waiting
        ? `Working out the words of ${waiting > 1 ? waiting + ' voice notes' : 'the voice note'}…`
        : desk()
          ? 'The first line is the title. Esc keeps it as a draft.'
          : 'The first line is the title.',
  }
}
