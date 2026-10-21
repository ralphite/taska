// The one input box (B164, R108), the same in every state: the line on top says what it writes to, then the files,
// then one row: + (x while recording), the text (or the recording in the same place and size), and one round button
// that never moves: the mic while the box is empty, Send once there is something to send, a check while recording.
// B265: it is one element, written where it belongs (under a passage, in a thread, under an input); it moves there.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HIT, LINK_BTN } from '../lib/constants'
import {
  D,
  OV,
  R_STATE as R,
  U,
  bump,
  byN,
  byR,
  clock,
  code,
  ctx,
  desk,
  detailShown,
  docOpen,
  els,
  esc,
  liveN,
  model,
  oneLine,
  plural,
  projTitle,
  rcode,
  ruleMode,
  scopeN,
  useArea,
  otherProjects,
  projName,
} from '../lib/state'
import type { DraftFile, Job } from '../lib/state'
import { draftName, keepDraftFiles, saveDraft } from '../lib/drafts'
import { docTarget } from '../lib/docs'
import { plainQuote, ico } from '../lib/markdown'
import { draftSpots, unmarked, vcCount, vcSelection, vcScroller } from '../lib/voice'
import { addFiles, grow, send } from '../lib/outbox'
import { setFix } from '../lib/settings'
import { toast } from '../lib/toast'
import { Icon, Kbd, ProjTile } from './ui'
import { outboxLine } from './Inputs'

// ---------------------------------------------------------------- where the box is
// B345: under an item's talk the box lies on the talk's grey with no shadow: nothing passes under it there
export const BOX: HTMLDivElement = (() => {
  const b = document.createElement('div')
  b.id = 'composer'
  b.className =
    'group/box rounded-4xl border border-zinc-200 bg-white shadow-lg shadow-black/5 focus-within:border-zinc-300 lg:in-data-talk:shadow-none lg:mx-auto lg:max-w-[42rem] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40 dark:focus-within:border-zinc-700'
  return b
})()
const home = () => document.getElementById('boxHome')
function boxAnchor(): Element | null {
  if (U.prefsEdit) return document.querySelector('#projectBody [data-prefs-slot]')
  const a = U.amend
  if (a && a.mode === 'dc' && desk() && docOpen()) return null // B340: on the desktop the box stays at the bottom
  if (a)
    return a.mode === 'dc'
      ? document.querySelector(`[data-dc="${a.id}"]`)
      : document.querySelector(
          `#detailBody [data-src="${a.id}"], #inputsView [data-r="${a.id}"], #detailBody [data-r="${a.id}"], #foot [data-src="${a.id}"]`,
        )
  const d = docOpen()
  if (!d || desk() || !U.docType) return null // I285: on the phone the box comes into the document only after Aa; B340: never on the desktop (the text never moves)
  const root = desk() ? els.detailBody : document.getElementById('dlgBody'),
    t = docTarget()
  if (!root) return null
  if (t?.reply) return root.querySelector(`[data-thread="${CSS.escape(t.key)}"]`)
  if (t)
    return (
      [...root.querySelectorAll<HTMLElement>('#docBlocks section[data-key]')]
        .filter((sec) => sec.dataset.key === t.key || U.docSel.has(sec.dataset.key || ''))
        .at(-1) || null
    )
  return null // B282: nothing picked: a comment on the whole document is written at the bottom
}
/** Home, before a pane that may hold it is drawn again; it goes back once the pane is there. */
export function parkBox() {
  const h = home()
  if (h && BOX.nextElementSibling !== h) {
    const had = document.activeElement === els.text
    h.before(BOX)
    BOX.classList.remove('my-3')
    if (had) els.text?.focus({ preventScroll: true })
  }
}
export const boxAway = () => !!home() && BOX.nextElementSibling !== home()
export function placeBox() {
  if (U.doc && !U.docEdit) U.docPick[U.doc] = { sel: [...U.docSel], quote: U.docQuote, reply: U.docReply } // B265: kept for when it opens again
  const a = boxAnchor(),
    had = document.activeElement === els.text
  if (a && a.nextElementSibling !== BOX) {
    a.after(BOX)
    BOX.classList.add('my-3')
    if (had) els.text?.focus({ preventScroll: true })
    BOX.scrollIntoView({ block: 'nearest' })
  } else if (!a) parkBox()
  const hint = document.getElementById('boxHint')
  if (hint) hint.hidden = !!a
}
export const footRoom = () => (!boxAway() ? document.getElementById('foot')?.offsetHeight || 0 : 0) // a sheet leaves room for the box only while it is at the bottom

// ---------------------------------------------------------------- the line on top
const ScopeLink = ({ act, text, k = '', title = '' }: { act: string; text: string; k?: string; title?: string }) => (
  <button
    data-act={act}
    {...(title ? { title } : {})}
    className={`${HIT} -my-1 flex h-8 shrink-0 items-center rounded-full px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
  >
    {text}
    {k ? <Kbd k={k} /> : null}
  </button>
)
const ScopeX = ({ act, label }: { act: string; label: string }) => (
  <button
    data-act={act}
    aria-label={label}
    title={`${label} · Esc`}
    className="-my-1.5 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-zinc-800 lg:size-8 lg:hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:lg:hover:bg-zinc-800"
  >
    <Icon n="x" c="size-4" />
  </button>
)
export const RuleFlip = () =>
  U.tab === 'rules' ? <ScopeLink act="as-rule" text={ruleMode() ? 'Plain input instead' : 'As a rule instead'} /> : null
function ScopeLine({
  icon,
  label,
  detail,
  right,
}: {
  icon: string
  label: ReactNode
  detail?: ReactNode
  right?: ReactNode
}) {
  const S = model.S
  return (
    <>
      {desk() && S.project ? (
        <span className="mr-0.5 flex shrink-0 items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">
          <ProjTile name={S.project} cls="size-[18px] rounded-[5px] text-[10px]" />
          <span className="max-w-40 truncate">{projTitle()}</span>
          <span className="font-normal text-zinc-300 dark:text-zinc-600">›</span>
        </span>
      ) : null}
      <Icon n={icon} c="size-3.5 text-zinc-400 dark:text-zinc-500" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
        {detail ? <> {detail}</> : null}
      </span>
      {right}
    </>
  )
}
const isVoice = (r: { files?: { mime?: string }[] } | undefined) =>
  !!r?.files?.some((f) => (f.mime || '').startsWith('audio/'))
const ticked = (n: number | null) =>
  n && U.choice?.n === n && U.choice.picked.size
    ? [...U.choice.picked]
        .sort((a, c) => a - c)
        .map((i) => (U.choiceLabels[n] || [])[i])
        .filter(Boolean)
    : []
// What the box writes to now: the line on top, the placeholder and what Send says.
function boxRole(): { line: ReactNode; ph: string; send: string } {
  const S = model.S,
    n = scopeN(),
    dt = docTarget(),
    dOpen = !U.correct && !U.amend && !dt ? docOpen() : undefined,
    t = els.text
  const ticks = U.correct || U.amend || dt || dOpen ? [] : ticked(n)
  const vcd = !U.correct && !U.amend ? docOpen() : undefined,
    vcN = vcd ? vcCount(t?.value || '') : 0 // F184
  let line: ReactNode = null,
    ph = S.project ? `Write to ${projTitle()}…` : 'Write anything…',
    send = 'Send'
  const filesWord = desk()
    ? S.org?.on
      ? 'the organizer files it'
      : 'your agent files it'
    : S.org?.on
      ? 'the organizer files it'
      : 'your agent files it'
  const am = U.amend
  if (U.prefsEdit) {
    line = (
      <ScopeLine
        icon="pencil"
        label="Edit transcription preferences"
        detail="· every project"
        right={<ScopeX act="prefs-cancel" label="Stop editing" />}
      />
    )
    ph = 'How voice notes should be written down…'
    send = 'Save'
  } else if (U.correct && byR.has(U.correct.id)) {
    const right = (t?.value || '').replace(/\s+/g, ' ').trim() // A3: before -> after, as you type
    line = (
      <ScopeLine
        icon="pencil"
        label={`Correct “${U.correct.wrong}”${right ? ` → “${right.slice(0, 60)}”` : ''}`}
        detail={`in ${U.correct.id} · remembered for every project`}
        right={<ScopeX act="correct-cancel" label="Stop correcting" />}
      />
    )
    ph = `The right words for “${U.correct.wrong}”…`
    send = 'Save'
  } else if (am?.mode === 'dc') {
    line = (
      <ScopeLine
        icon="pencil"
        label={`Edit your comment on D${am.d}`}
        detail={oneLine(am.was) ? `“${oneLine(am.was).slice(0, 120)}”` : ''}
        right={<ScopeX act="amend-cancel" label="Stop editing" />}
      />
    )
    ph = 'Edit your comment…'
    send = 'Save'
  } else if (am && byR.has(am.id)) {
    const r = byR.get(am.id),
      edit = am.mode === 'edit'
    line = (
      <ScopeLine
        icon={edit ? 'pencil' : 'listplus'}
        label={`${edit ? 'Edit' : 'Add details to'} ${rcode(am.id)}`}
        detail={
          oneLine(r?.text)
            ? `“${oneLine(r?.text).slice(0, 120)}”`
            : `· ${isVoice(r) ? 'a voice note' : plural(r?.files.length || 0, 'file')}`
        }
        right={<ScopeX act="amend-cancel" label={edit ? 'Stop editing' : 'Stop adding details'} />}
      />
    )
    ph = edit ? `Edit ${rcode(am.id)}…` : `Add details to ${rcode(am.id)}…`
    send = 'Save'
  } else if (vcN && vcd) {
    line = (
      <ScopeLine
        icon="comment"
        label={`${plural(vcN, 'comment')} on D${vcd.d} not sent`}
        detail="· Send posts each beside its paragraph"
      />
    )
    ph = 'Words for the comments…'
    send = vcN > 1 ? `Post ${vcN} comments` : 'Post the comment'
  } else if (dt) {
    line = (
      <ScopeLine
        icon={dt.reply ? 'reply' : 'comment'}
        label={`${dt.reply ? 'Reply in' : 'Comment on'} D${dt.d.d}`}
        detail={
          (dt.many || 0) > 1 ? `· ${dt.many} paragraphs` : dt.quote ? `“${plainQuote(dt.quote).slice(0, 120)}”` : ''
        }
        right={<ScopeX act="doc-unpick" label="Cancel the comment" />}
      />
    )
    ph = `${dt.reply ? 'Reply in' : 'Comment on'} D${dt.d.d}…`
    send = dt.reply ? 'Reply' : 'Comment' // T225 #16
  } else if (dOpen) {
    // B247: a document open and nothing picked: a comment on the whole document (never a reply to the item, B2)
    const host = liveN(dOpen.n)
    line = desk() ? null : ( // B340 (D24 #6): on the desktop nothing picked is a reply to the item the document is on: no line, no switch
      <ScopeLine
        icon="comment"
        label={`Comment on D${dOpen.d}`}
        detail="· or tap a part"
        right={
          byN.has(host) ? (
            <ScopeLink act="doc-to-item" text={`Reply to ${code(host)}`} title={`Reply to ${code(host)} instead`} />
          ) : null
        }
      />
    ) // T225 #14
    ph = desk() ? `Reply to ${code(host)}…` : `Comment on D${dOpen.d}…`
    send = desk() ? 'Send' : 'Comment'
  } else if (n) {
    // T322 (D22): writing in an item is a reply to it, nothing more: the box says "Reply to F06…"; no line above it,
    // no "New input instead" (New input has its own button)
    ph = `Reply to ${code(n)}…`
    if (U.ask === n) {
      ph = `What is missing in ${code(n)}?`
      send = 'Send back'
    } // B153, T274 #14
    if (ticks.length) send = 'Send answer'
  } else if (ruleMode()) {
    line = <ScopeLine icon="scope" label="New rule for this project" right={<RuleFlip />} />
    if (S.project) ph = `New rule for ${projTitle()}…`
  } else if (desk())
    line = (
      <ScopeLine
        icon="inbox"
        label="New input"
        detail={`· ${filesWord}`}
        right={<RuleFlip />} // T322 (D22): no "Add to T38 instead": New input and a reply each have their own place
      />
    )
  else if (U.open && detailShown() && byN.has(U.open))
    line = <ScopeLine icon="inbox" label="New input" detail={`· ${filesWord}`} right={<RuleFlip />} /> // B298
  else if (U.tab === 'rules')
    line = <ScopeLine icon="inbox" label="New input" detail="· not a rule" right={<RuleFlip />} />
  if (R.rec && R.key && R.key !== U.draftKey)
    line = <ScopeLine icon="mic" label={`Recording for ${draftName(R.key)}`} detail="· it goes there when you stop" /> // B1
  return { line, ph, send }
}

// ---------------------------------------------------------------- the draft's words, with the toggles (F186)
export function draftHtml(text: string, fix = false) {
  const vr = U.files
    .filter((f) => f.trAdded)
    .map((f) => {
      const at = text.indexOf(f.trAdded as string)
      return at < 0 ? null : ([at, at + (f.trAdded as string).length] as const)
    })
    .filter(Boolean) as (readonly [number, number])[]
  const inV = (o: number) => vr.some(([a, b]) => o >= a && o < b)
  const plain = (a: number, b: number) => {
    let out = ''
    for (let i = a; i < b;) {
      const v = inV(i)
      let j = i + 1
      while (j < b && inV(j) === v) j++
      out += `<span data-o="${i}"${v && fix ? ' data-v' : ''}>${esc(text.slice(i, j))}</span>`
      i = j
    }
    return out
  }
  let html = '',
    at = 0
  for (const p of draftSpots(text)) {
    const { x, o, i, k } = p,
      cur = text.slice(p.s, p.e)
    html += plain(at, p.s)
    at = p.e
    if (!x.alt) {
      html += `<span data-o="${p.s}"${fix ? ' data-v data-unsure' : ''} title="The model was not sure of these words" class="underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4 ${fix ? 'cursor-text' : ''}">${esc(cur)}</span>`
      continue
    }
    let [c0, c1] = x.show && o.was.includes(x.show[0]) && o.alt.includes(x.show[1]) ? x.show : [o.was, o.alt] // just the words that differ
    const core = x.pick === 'alt' ? c1 : c0,
      ix = core ? cur.indexOf(core) : -1
    if (ix < 0) [c0, c1] = [o.was, o.alt]
    const pre = ix < 0 ? '' : cur.slice(0, ix),
      post = ix < 0 ? '' : cur.slice(ix + core.length),
      side = x.pick || 'was'
    const btn = (sd: string, label: string) => {
      const on = side === sd
      return `<button data-act="doubt-pick" data-i="${i}" data-k="${k}" data-side="${sd}" aria-pressed="${on}" tabindex="${on ? 0 : -1}" title="${sd === 'was' ? 'Main model' : 'Other model'}${on ? ' · in the text now' : ''} · ← → or 1 2 to pick, Esc to the box" class="inline-flex items-center gap-1 rounded-md px-1.5 leading-6 ${on ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-700 dark:text-zinc-50 dark:ring-white/10' : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100'}">${on && x.pick ? ico('check', 'size-3.5 text-emerald-600 dark:text-emerald-400', '2.5') : ''}${esc(unmarked(label))}</button>`
    }
    html +=
      plain(p.s, p.s + pre.length) +
      `<span data-tog role="group" aria-label="Maybe misheard: two versions" class="mx-0.5 inline-flex items-center gap-px rounded-lg p-0.5 align-baseline whitespace-nowrap ring-1 ${x.pick ? 'bg-zinc-100 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700' : 'bg-amber-100/80 ring-amber-300 dark:bg-amber-400/15 dark:ring-amber-400/40'}">${btn('was', c0)}${btn('alt', c1)}</span>` +
      plain(p.e - post.length, p.e)
  }
  return html + plain(at, text.length)
}
// I176: on the New input page what is in the box shows at the top of "You said lately" as a Draft card.
let draftLast = ''
export function DraftCard() {
  useArea('composer')
  if (!desk() || !D.compose || U.amend || U.correct) return null
  const text = els.text?.value || ''
  if (!text.trim() && !U.files.length) return null
  const voice = U.files.filter((f) => (f.mime || '').startsWith('audio/')),
    other = U.files.length - voice.length,
    ms = voice.reduce((a, f) => a + (f.ms || 0), 0)
  const spots = draftSpots(text),
    open = new Set(spots.filter((p) => p.x.alt && !p.x.pick).map((p) => p.x)).size,
    picked = spots.some((p) => p.x.pick)
  const fixable = U.files.some((f) => f.trAdded && text.includes(f.trAdded))
  const hint = open ? (
    <>
      <b className="font-semibold text-zinc-700 dark:text-zinc-200">{plural(open, 'word')} to check.</b> Left: the main
      model, in the text now. Right: the other model. A click picks it in every place; click again to switch back, any
      time before you send.
    </>
  ) : picked ? (
    'Picked. Click the other side to switch back, any time before you send.'
  ) : fixable ? (
    'Select words of the voice note to correct them here: Taska remembers the spelling.'
  ) : null
  // not drawn again while you correct a word in it (the field is in its text)
  const html = U.fixEd ? draftLast : text.trim() ? draftHtml(text, true) : ''
  draftLast = html
  return (
    <li className="group/row relative mt-4 flex gap-3 pb-6">
      <span className="relative mt-1.5 grid size-6 shrink-0 place-items-center">
        <span className="size-3 rounded-full border-2 border-dashed border-blue-400 dark:border-blue-400/80" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold tracking-wider text-blue-700 uppercase dark:text-blue-300">Draft</span>
          <span>· not sent</span>
          {voice.length ? (
            <span className="flex items-center gap-1">
              · <Icon n="mic" c="size-3.5" />
              <span className="font-mono tabular-nums">{clock(ms)}</span> voice note{voice.length > 1 ? 's' : ''}
            </span>
          ) : null}
          {other ? <span>· {plural(other, 'file')}</span> : null}
          <span className="ml-auto flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
            <Kbd k="⇧↵" />
            <span>send</span>
          </span>
        </div>
        {text.trim() ? (
          <div
            id="draftText"
            className="mt-1 w-full rounded-2xl rounded-tl-md border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-[15px] leading-8 break-words whitespace-pre-wrap text-zinc-900 dark:border-blue-400/40 dark:bg-blue-400/5 dark:text-zinc-100"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div
            id="draftText"
            className="mt-1 w-full rounded-2xl rounded-tl-md border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-[15px] leading-8 break-words whitespace-pre-wrap text-zinc-900 dark:border-blue-400/40 dark:bg-blue-400/5 dark:text-zinc-100"
          >
            <span className="text-zinc-400 dark:text-zinc-500">
              {U.files.some((f) => f.transcribing) ? 'The words of the voice note are on their way…' : 'No words yet'}
            </span>
          </div>
        )}
        {hint ? (
          <div className="mt-2 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
            <p className="flex items-start gap-1.5">
              {open ? (
                <Icon n="alert" c="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" sw="2" />
              ) : (
                <Icon n="pencil" c="mt-px size-3.5 shrink-0" />
              )}
              <span>{hint}</span>
            </p>
          </div>
        ) : null}
      </div>
    </li>
  )
}
// The voice note's words you selected in the card turn into a small field, right there (I176)
export function draftFix() {
  const sel = getSelection()
  if (U.fixEd || !sel?.rangeCount || sel.isCollapsed) return
  const a = sel.anchorNode?.parentElement?.closest<HTMLElement>('#draftText [data-o]'),
    b = sel.focusNode?.parentElement?.closest('#draftText [data-o]')
  if (!a || a !== b || !a.hasAttribute('data-v')) return // within one stretch of the voice note's own words
  const text = els.text?.value || '',
    o = Number(a.dataset.o)
  let s = o + Math.min(sel.anchorOffset, sel.focusOffset),
    e = o + Math.max(sel.anchorOffset, sel.focusOffset)
  while (s < e && /\s/.test(text[s])) s++
  while (e > s && /\s/.test(text[e - 1])) e--
  const wrong = text.slice(s, e)
  if (!wrong) return
  if (wrong.length > 60) return toast('Select up to 60 characters to correct')
  U.fixEd = { s, e, wrong }
  const r = sel.getRangeAt(0),
    ed = document.createElement('span')
  r.deleteContents()
  ed.id = 'fixEd'
  ed.contentEditable = 'plaintext-only'
  ed.textContent = wrong
  ed.title = 'The right words · Enter keeps them, Esc stops'
  ed.className =
    'rounded-md bg-white px-1 py-0.5 text-zinc-900 outline-none ring-2 ring-amber-400 dark:bg-zinc-800 dark:text-zinc-50'
  r.insertNode(ed)
  ed.focus()
  const all = document.createRange()
  all.selectNodeContents(ed)
  sel.removeAllRanges()
  sel.addRange(all)
  const redraw = () => {
    draftLast = ''
    const card = document.getElementById('draftText')
    if (card) card.innerHTML = (els.text?.value || '').trim() ? draftHtml(els.text?.value || '', true) : ''
  }
  ed.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault()
      ev.stopPropagation()
      void draftFixSave(redraw)
    } else if (ev.key === 'Escape') {
      ev.preventDefault()
      ev.stopPropagation()
      U.fixEd = null
      redraw()
    }
  })
  ed.addEventListener('blur', () => {
    if (U.fixEd) {
      U.fixEd = null
      redraw()
    }
  })
}
async function draftFixSave(redraw: () => void) {
  const ed = document.getElementById('fixEd'),
    x = U.fixEd,
    right = (ed?.textContent || '').replace(/\s+/g, ' ').trim(),
    t = els.text
  if (!t) return
  const before = t.value
  U.fixEd = null
  if (!x || !right || right === x.wrong || before.slice(x.s, x.e) !== x.wrong) return redraw()
  for (const f of U.files) {
    // the voice note's words keep their stretch
    const at = f.trAdded ? before.indexOf(f.trAdded) : -1
    if (f.trAdded && at >= 0 && x.s >= at && x.e <= at + f.trAdded.length)
      f.trAdded = f.trAdded.slice(0, x.s - at) + right + f.trAdded.slice(x.e - at)
  }
  t.value = before.slice(0, x.s) + right + before.slice(x.e)
  saveDraft()
  grow()
  redraw()
  BUMP()
  let had: { wrong: string; right: string } | null = null
  try {
    had =
      (
        (await (await fetch('/api/corrections', { cache: 'no-store' })).json()) as { wrong: string; right: string }[]
      ).find((c) => c.wrong === x.wrong) || null
  } catch {
    /* none known */
  }
  try {
    await setFix({ wrong: x.wrong, right })
  } catch {
    return
  } // setFix said why; the draft keeps your words
  toast(`Remembered: “${x.wrong}” → “${right}”`, async () => {
    const cur = t.value
    if (cur.slice(x.s, x.s + right.length) === right) {
      t.value = cur.slice(0, x.s) + x.wrong + cur.slice(x.s + right.length)
      saveDraft()
      grow()
      BUMP()
    }
    await setFix(had ? { wrong: x.wrong, right: had.right } : { wrong: x.wrong })
  })
}
const BUMP = () => bump('composer')

// ---------------------------------------------------------------- the box
function DraftFiles() {
  return (
    <>
      {U.files.map((f: DraftFile, i) => (
        <div key={i} className="relative shrink-0">
          {(f.mime || '').startsWith('audio/') ? (
            <div className="flex h-16 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              <Icon n="mic" c="size-4" />
              <span className="font-mono tabular-nums">{clock(f.ms || 0)}</span>
              <span
                className={`font-semibold ${f.transcribing ? 'animate-pulse text-blue-600 dark:text-blue-400' : f.more ? 'max-w-40 leading-snug text-amber-700 dark:text-amber-400' : f.tr ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}
              >
                {f.transcribing
                  ? f.retrying
                    ? 'Retrying…'
                    : 'Transcribing…'
                  : f.more
                    ? 'May be cut short · fuller words on the way'
                    : f.tr
                      ? 'Transcribed'
                      : f.tr_error
                        ? 'No transcript: the audio goes as it is'
                        : 'No words heard: the audio goes as it is'}
              </span>
            </div>
          ) : (f.mime || '').startsWith('image/') ? (
            <button
              data-act="view-draft"
              data-i={i}
              aria-label={`Look at ${f.name}`}
              className="block cursor-zoom-in rounded-xl"
            >
              <img
                src={f.preview || `${ctx.P}f/${encodeURIComponent(f.f || '')}`}
                alt=""
                className={`size-16 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}`}
              />
            </button>
          ) : (
            <div
              className={`flex h-16 w-28 items-center gap-1 rounded-xl border border-zinc-200 px-2 text-xs dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}`}
            >
              <Icon n="file" c="size-4" />
              <span className="line-clamp-2 break-all">{f.name}</span>
            </div>
          )}
          <button
            data-act="unfile"
            data-i={i}
            aria-label={`Remove ${f.name}`}
            className="absolute -top-3.5 -right-3.5 grid size-11 place-items-center"
          >
            <span className="grid size-6 place-items-center rounded-full bg-zinc-900 text-white ring-2 ring-white dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900">
              <Icon n="x" c="size-3.5" sw="2.5" />
            </span>
          </button>
        </div>
      ))}
    </>
  )
}
// T101, F186: where the two transcriptions disagree, said under the voice note before you send
function Doubts({ words }: { words: string }) {
  const spots = U.files
    .flatMap((f, i) => (f.doubts || []).map((x, k) => ({ i, k, x })))
    .filter(({ x }) => !x.pick && words.includes(x.was))
  const toCheck = spots.filter(({ x }) => x.alt).length,
    alert = <Icon n="alert" c="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" sw="2" />
  const pickable = !desk() && draftSpots(words).some((p) => p.x.alt),
    view = pickable && U.boxView && !R.rec
  if (desk() && D.compose)
    return toCheck ? (
      <p className="flex min-h-8 items-center gap-1.5">
        {alert}
        <span className="min-w-0">
          {plural(toCheck, 'word')} may be misheard. They are marked in the draft below: pick there.
        </span>
      </p>
    ) : null
  if (!desk())
    return pickable ? (
      <p className="flex min-h-8 items-start gap-1.5 py-1">
        {alert}
        <span className="min-w-0">
          {toCheck ? (
            <>
              <b className="font-semibold text-zinc-800 dark:text-zinc-100">{plural(toCheck, 'word')} to check.</b>{' '}
              Left: main model, right: the other. A tap changes every place.
            </>
          ) : (
            'Picked. Tap the other side to switch back before you send.'
          )}
          {view ? null : (
            <>
              {' '}
              <button data-act="box-view" className={`${LINK_BTN} -my-2 inline-flex`}>
                Show them
              </button>
            </>
          )}
        </span>
      </p>
    ) : null
  return (
    <>
      {spots.map(({ i, k, x }) => {
        const [said, heard] = x.show || [x.was, x.alt]
        return (
          <p key={`${i}-${k}`} className="flex min-h-8 items-center gap-1.5">
            {alert}
            <span className="min-w-0">
              Maybe misheard: “{unmarked(said)}”
              {x.alt
                ? ` — the other model heard “${heard}”${x.also?.length ? ` (${x.also.length + 1} places)` : ''} ·`
                : ' — the model was not sure'}
            </span>
            {x.alt ? (
              <button data-act="doubt-use" data-i={i} data-k={k} className={`${LINK_BTN} -my-1 -ml-1.5 shrink-0`}>
                Use it
              </button>
            ) : null}
          </p>
        )
      })}
    </>
  )
}
const hasDoubts = (words: string) => {
  const spots = U.files.flatMap((f) => f.doubts || []).filter((x) => !x.pick && words.includes(x.was))
  if (desk() && D.compose) return spots.some((x) => x.alt)
  if (!desk()) return draftSpots(words).some((p) => p.x.alt)
  return spots.length > 0
}
function RecBar() {
  useArea('rec')
  return (
    <>
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      <span id="recTime" className="shrink-0 font-mono text-[15px] text-zinc-800 tabular-nums dark:text-zinc-100">
        {R.rec ? clock(Date.now() - R.t0) : '0:00'}
      </span>
      <span
        id="recBars"
        className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden lg:group-data-[compose]/app:h-14"
      >
        {R.rec
          ? R.levels.map((l, i) => (
              <span
                key={i}
                className="w-[3px] shrink-0 rounded-full bg-zinc-500 dark:bg-zinc-400"
                style={{ height: Math.round(4 + l * 24) }}
              />
            ))
          : null}
      </span>
    </>
  )
}
/** B300: a paragraph's microphone shows the recording's time too. */
export function RecTime() {
  useArea('rec')
  return <>{R.rec ? clock(Date.now() - R.t0) : '0:00'}</>
}
interface Btn {
  act: string
  icon: string
  label: string
  tip: string
  iconCls: string
  sw: string
}
const btn = (
  act: string,
  icon: string,
  label: string,
  tip: string,
  iconCls = 'size-6 lg:size-5',
  sw = '1.75',
): Btn => ({ act, icon, label, tip, iconCls, sw })
const BoxBtn = ({ b, id, cls, hidden = false }: { b: Btn; id: string; cls: string; hidden?: boolean }) => (
  <button
    id={id}
    data-act={b.act}
    data-icon={b.icon}
    aria-label={b.label}
    data-tip={desk() ? b.tip : ''}
    hidden={hidden}
    className={cls}
  >
    <Icon n={b.icon} c={b.iconCls} sw={b.sw} />
  </button>
)
function BoxInner() {
  useArea('composer')
  const t = els.text,
    words = t?.value || ''
  const { line, ph, send: sendWord } = boxRole()
  const rec = !!R.rec,
    has = !!(words.trim() || U.files.length)
  const view = !desk() && draftSpots(words).some((p) => p.x.alt) && U.boxView && !rec
  const micTip = !window.isSecureContext
    ? 'Voice needs an https link here: press for it'
    : D.compose
      ? 'Record a voice note · ⌥V'
      : 'Record a voice note · V, or ⌥V while typing'
  const attach = rec
    ? btn('rec-cancel', 'x', 'Discard the recording', 'Discard · Esc')
    : btn('attach', 'plus', 'Add images or files', 'Add images or files')
  const recSend = btn('rec-send', 'up', 'Stop and send', 'Stop and send · ⇧↵', 'size-5', '2'),
    recStop = btn('rec-stop', 'check', 'Stop recording, words into the box', 'Words into the box · ↵', 'size-5', '2.5')
  // F221, B248: a second tap where you started recording sends it; the other button stops it into the box
  const started = R.from === 'aux' ? 'aux' : 'main'
  const main = rec
    ? started === 'main'
      ? recSend
      : recStop
    : has
      ? btn('send', 'up', `${sendWord} (Shift + Enter)`, `${sendWord} · ⇧↵`, 'size-5', '2.25')
      : btn('mic', 'mic', 'Record a voice note', micTip)
  const aux = rec
    ? started === 'main'
      ? recStop
      : recSend
    : btn('mic', 'mic', 'Record a voice note', micTip, 'size-5')
  const quiet = rec || has
  useLayoutEffect(() => {
    if (t && t.placeholder !== ph) t.placeholder = ph
    t?.classList.toggle('invisible', rec || view)
    if (t) {
      // empty = one line from the classes; T231: past one line the words take the box's whole width, the buttons a row under them
      t.style.height = ''
      if (t.value) {
        t.style.height = 'auto'
        t.style.height = Math.min(t.scrollHeight, desk() && D.compose ? 320 : 192) + 'px'
      }
      const multi = !!t.value && (t.value.includes('\n') || t.scrollHeight > 52)
      if (multi !== BOX.hasAttribute('data-multi')) {
        BOX.toggleAttribute('data-multi', multi)
        if (multi) {
          t.style.height = 'auto'
          t.style.height = Math.min(t.scrollHeight, 192) + 'px'
        }
      }
    }
    keepDraftFiles()
    placeBox()
    if (U.fbFor !== (scopeN() || null)) {
      U.fbFor = scopeN() || null
      bump('feedback')
    } // T225 #1: the box writes elsewhere now: the "Sent" line about the other item goes
    bump('vc', 'toast')
  })
  return (
    <>
      <div
        id="scope"
        hidden={!line}
        className="flex h-8 items-center gap-1.5 pt-1 pr-1.5 pl-4 text-[13px] text-zinc-500 lg:group-data-[compose]/app:hidden dark:text-zinc-400"
      >
        {line}
      </div>
      <div
        id="drafts"
        hidden={!U.files.length}
        className="flex gap-2.5 overflow-x-auto px-3 pt-3 pb-1 lg:scrollbar-thin"
      >
        <DraftFiles />
      </div>
      <div
        id="doubts"
        hidden={!hasDoubts(words)}
        className="flex flex-col px-4 pt-1 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300"
      >
        <Doubts words={words} />
      </div>
      <div className="flex items-end gap-2 p-1.5 group-data-[multi]/box:flex-wrap lg:gap-0.5">
        <BoxBtn
          b={attach}
          id="attachBtn"
          cls="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 lg:m-1 lg:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 group-data-[multi]/box:mr-auto"
        />
        <div className="grid min-w-0 flex-1 group-data-[multi]/box:order-first group-data-[multi]/box:basis-full group-data-[multi]/box:px-2 group-data-[multi]/box:pt-1">
          <TextArea />
          <div
            id="boxView"
            hidden={!view}
            className="col-start-1 row-start-1 max-h-48 min-h-11 overflow-y-auto px-1 py-1.5 text-[17px] leading-8 break-words whitespace-pre-wrap text-zinc-900 sm:text-[15px] dark:text-zinc-100"
            onClick={(e) => {
              if ((e.target as Element).closest('button')) return
              U.boxView = false
              bump('composer')
              els.text?.focus()
            }} // F186: plain text: back to typing
            dangerouslySetInnerHTML={{ __html: view ? draftHtml(words) : '' }}
          />
          <div
            id="recBar"
            hidden={!rec}
            role="status"
            aria-label="Recording"
            className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 px-1 lg:group-data-[compose]/app:px-3"
          >
            <RecBar />
          </div>
        </div>
        <BoxBtn
          b={aux}
          id="micBtn"
          hidden={!quiet}
          cls="mr-4 grid size-11 shrink-0 place-items-center rounded-full lg:mr-0 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 lg:m-1 lg:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        />
        <BoxBtn
          b={main}
          id="sendBtn"
          cls="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-white disabled:opacity-25 lg:m-1 lg:size-9 lg:hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:lg:hover:bg-white"
        />
      </div>
      <input
        id="fileInput"
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void addFiles([...(e.target.files || [])])
          e.target.value = ''
        }}
      />
    </>
  )
}
// The textarea is the page's: its words are read and written by the actions (lib/outbox.ts, voice.ts), never by React.
function TextArea() {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    els.text = ref.current
  }, [])
  return (
    <textarea
      id="text"
      ref={ref}
      rows={1}
      placeholder="Write anything…"
      aria-label="Input"
      className="col-start-1 row-start-1 max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent px-1 py-2.5 text-[17px] leading-6 outline-none placeholder:text-zinc-400 sm:text-[15px] lg:scrollbar-thin dark:placeholder:text-zinc-500"
      onInput={() => {
        saveDraft()
        bump('composer')
        grow()
      }} // the buttons first: the mic showing up narrows the box
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && (e.shiftKey || e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void send()
        }
      }}
      onPaste={(e) => {
        const files = [...(e.clipboardData?.files || [])]
        if (files.length) {
          e.preventDefault()
          void addFiles(files)
        }
      }}
      onFocus={() => {
        // B153: while you type with the card open, what you answer stays in sight: its buttons make room
        if (desk() || !U.peek || !OV.spec) return
        const f = document.getElementById('dlgFoot')
        if (f) f.hidden = true
        requestAnimationFrame(() =>
          document.getElementById('dlgBody')?.querySelector('[data-need]')?.scrollIntoView({ block: 'start' }),
        )
      }}
      onBlur={() => {
        const f = document.getElementById('dlgFoot')
        if (!desk() && U.peek && OV.spec && f?.innerHTML) f.hidden = false
      }}
    />
  )
}
/** The box itself, drawn into its own element (BOX), which moves to where it writes. */
export function Composer() {
  return createPortal(<BoxInner />, BOX)
}
/** Where the box lives when it is at home: #foot, before #boxHome. */
export function BoxHomeSlot() {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const h = ref.current
    if (h && !BOX.isConnected) h.before(BOX)
    els.composer = BOX
    els.boxHome = h
  }, [])
  return <span id="boxHome" ref={ref} hidden />
}
export function BoxHint() {
  useArea('composer')
  return (
    <p
      id="boxHint"
      className="mt-1.5 hidden h-5 items-center justify-center gap-1 text-xs text-zinc-400 lg:mx-auto lg:flex lg:max-w-[42rem] dark:text-zinc-500"
    >
      {desk() && R.rec ? (
        <>
          <Kbd k="↵" />
          <span>words into the box</span>
          <span className="px-0.5">·</span>
          <Kbd k="⇧↵" />
          <span>stop and send</span>
          <span className="px-0.5">·</span>
          <Kbd k="Esc" />
          <span>discard</span>
        </>
      ) : null}
    </p>
  )
}

// ---------------------------------------------------------------- the line above the box: what happened to what you sent
let fbTimer = 0
const unsendBtn = (job: Job | undefined) =>
  job?.undo && !job.undo.entry?.done ? (
    <button
      data-act="unsend"
      data-q={job.q}
      className="-my-2 h-11 shrink-0 rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400"
    >
      Undo
    </button>
  ) : null
const Link = ({ act, label, data = {} }: { act: string; label: string; data?: Record<string, string | number> }) => (
  <button
    data-act={act}
    {...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v]))}
    className="-my-2 h-11 shrink-0 rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400"
  >
    {label}
  </button>
)
const Dismiss = () => (
  <button
    data-act="dismiss"
    aria-label="Dismiss"
    className="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400"
  >
    <Icon n="x" c="size-3.5" sw="2" />
  </button>
)
const pulse = <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
function feedbackBody(): { node: ReactNode; final?: string } | null {
  const S = model.S
  if (U.note === 'voice-why') {
    const link = S.remote ? S.remote + '/' : '',
      a = 'flex h-11 shrink-0 items-center rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400'
    return {
      node: (
        <>
          <Icon n="mic" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span className="min-w-0 flex-1 py-1 leading-snug">
            {link ? (
              'Voice needs a secure link, and this address is plain http. Open Taska’s https link to record:'
            ) : (
              <>
                Voice needs a secure link: https, or localhost on this computer. This address is plain http, and Taska
                has no https link yet (start it with <code className="whitespace-nowrap">--public</code>).
              </>
            )}
          </span>
          {link ? (
            <>
              <a href={link} target="_blank" rel="noopener" className={`-my-2 ${a}`}>
                Open
              </a>
              <button data-act="copy-text" data-text={link} className={`-my-2 ${a}`}>
                Copy
              </button>
            </>
          ) : null}
          <Dismiss />
        </>
      ),
    }
  }
  if (U.note)
    return {
      node: (
        <>
          <span className="min-w-0 flex-1">{U.note}</span>
          <Dismiss />
        </>
      ),
    }
  const q = U.outbox[0]?.quiet && !U.outbox[0].failed ? null : U.outbox[0] // T113 A19
  let r = U.lastSent ? byR.get(U.lastSent) : undefined
  if (r && (r.scope && byN.has(r.scope) ? code(r.scope) : null) !== (scopeN() ? code(scopeN() as number) : null))
    r = undefined // B129: only where it went
  if (q) {
    const more = U.outbox.length > 1 ? ` (+${U.outbox.length - 1})` : ''
    return {
      node: q.failed ? (
        <>
          <Icon n="alert" c="size-4 text-red-600 dark:text-red-400" sw="2" />
          <span className="min-w-0 flex-1 truncate text-red-600 dark:text-red-400">
            Not sent{more}: {outboxLine(q)}
          </span>
          <Link act="outbox-retry" label="Retry" />
          <Link act="outbox-edit" label="Edit" />
        </>
      ) : (
        <>
          {pulse}
          <span className="min-w-0 flex-1 truncate">
            {q.files.some((f) => !f.f && !f.failed) ? 'Uploading, then sending' : 'Sending'}
            {more}: {outboxLine(q)}
          </span>
          {unsendBtn(q)}
        </>
      ),
    }
  }
  if (!r) return null
  const move =
    otherProjects().length && !r.scope ? <Link act="move-input" label="Move to…" data={{ id: r.id }} /> : null // F79
  let node: ReactNode
  if (r.moved)
    node = (
      <>
        <Icon n="arrow" c="size-4 text-zinc-500" sw="2" />
        <span className="min-w-0 flex-1 truncate">
          Moved {rcode(r.id)} to {projName(r.moved.to)} as {rcode(r.moved.as)}
        </span>
        <a
          href={`/p/${encodeURIComponent(r.moved.to)}/`}
          className="-my-2 flex h-11 shrink-0 items-center rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400"
        >
          Open
        </a>
      </>
    )
  else if (r.tr_wait)
    node = (
      <>
        {pulse}
        <span className="min-w-0 flex-1 truncate">Sent. Its voice note&apos;s words come next…</span>
      </>
    ) // B165
  else if (S.org?.busy === r.id || (!r.acked && S.org?.on && !r.org))
    node = (
      <>
        {pulse}
        <span className="min-w-0 flex-1 truncate">Sent, organizing…</span>
      </>
    )
  else if (r.org && !r.org.ok)
    node = (
      <>
        <Icon n="alert" c="size-4 text-red-600 dark:text-red-400" sw="2" />
        <span className="min-w-0 flex-1 truncate text-red-600 dark:text-red-400">Organizer failed: {r.org.msg}</span>
        <Link act="retry" label="Retry" data={{ id: r.id }} />
      </>
    )
  else if (r.org?.undone) node = <span className="min-w-0 flex-1 truncate">Undid the changes for {rcode(r.id)}</span>
  else if (r.acked)
    node = (
      <>
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">
          <Icon n="check" c="size-3" sw="3" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {r.org?.msg || (r.touched.length ? 'Organized' : 'Seen by your agent, no item made')}
        </span>
        {r.touched.length ? <Link act="goto" label="View" data={{ n: r.touched[0] }} /> : null}
        {r.org && r.org.ok && !r.org.undone && !r.org.keep && r.touched.length ? (
          <Link act="undo" label="Undo" data={{ id: r.id }} />
        ) : null}
        {move}
      </>
    )
  else
    node = (
      <>
        <span className="size-2 shrink-0 rounded-full bg-zinc-400" />
        <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
          Sent. {r.org ? 'Left for your agent' : 'Waiting for your agent'}
        </span>
        {unsendBtn(U.sentJobs.find((j) => j.rid === r?.id))}
        {move}
      </>
    ) // T113 A27
  const final = r.acked || (r.org && r.org.ok) || r.moved
  return {
    node: (
      <>
        {node}
        <Dismiss />
      </>
    ),
    final: final ? r.id : undefined,
  }
}
export function Feedback() {
  useArea('feedback')
  useArea('composer')
  const fb = feedbackBody()
  useLayoutEffect(() => {
    clearTimeout(fbTimer)
    const id = fb?.final
    if (id)
      fbTimer = window.setTimeout(() => {
        if (U.lastSent === id) {
          U.lastSent = null
          bump('feedback')
        }
      }, 6000)
  })
  return (
    <div
      id="feedback"
      hidden={!fb}
      role="status"
      className={`mb-1.5 flex min-h-7 items-center gap-2 pr-1 pl-2.5 text-[13px] text-zinc-600 lg:mx-auto lg:max-w-[42rem] dark:text-zinc-300 ${U.note ? '' : 'lg:group-data-[compose]/app:hidden'}`}
    >
      {fb?.node}
    </div>
  )
}

// ---------------------------------------------------------------- the New input page's head (B73)
export function ComposeHeadDefault() {
  const S = model.S
  return (
    <>
      <div className="flex items-center gap-3">
        <ProjTile name={S.project} cls="size-11 rounded-xl text-xl shadow-sm" />
        <h1 className="text-[28px] leading-none font-semibold tracking-tight">{projTitle()}</h1>
      </div>
      <p className="mt-3.5 flex items-center justify-center gap-0 text-[15px] text-zinc-500 dark:text-zinc-400">
        {ruleMode() ? (
          <>
            <span className="font-medium text-zinc-700 dark:text-zinc-200">New rule</span>&nbsp;for the whole project
          </>
        ) : (
          'New input to the whole project'
        )}
        <span className="px-1.5 text-zinc-300 dark:text-zinc-600">·</span>
        <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-200">
          <Icon n="sparkle" c="size-4 text-blue-600 dark:text-blue-400" />
          {S.org?.on ? 'the organizer files it' : 'your agent files it'}
        </span>
      </p>
      {U.tab === 'rules' ? (
        <div className="mt-2 flex justify-center">
          <RuleFlip />
        </div>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------- the bar on the selected text (F184, F204, T274 #1)
export function VcBar() {
  useArea('vc')
  useArea('rec')
  const ref = useRef<HTMLDivElement>(null)
  const on = !!(R.vc && R.rec),
    s = on || R.rec ? null : vcSelection()
  const fix = !on && !R.rec && !!U.fixCand && getSelection()?.toString().replace(/\s+/g, ' ').trim() === U.fixCand.wrong // F204
  const cmt = !on && !R.rec && !!s?.key && !!U.doc
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar) return
    const range = on ? R.vc?.range : s?.range
    let r: { top: number; bottom: number; left: number; width: number; height: number } | undefined =
      range?.getBoundingClientRect()
    if (on && R.vc && !r?.width && !r?.height) {
      // the page was drawn again meanwhile: where the selection was, as the page scrolled since
      const dy = (vcScroller()?.scrollTop || 0) - R.vc.top,
        o = R.vc.rect
      r = { top: o.top - dy, bottom: o.bottom - dy, left: o.left, width: o.width, height: o.height }
    }
    bar.hidden = !r || (!r.width && !r.height) || (on && !desk() && !R.vc?.range) // B300
    if (bar.hidden || !r) return
    const below = r.bottom + 8 + bar.offsetHeight < innerHeight - 8
    bar.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - bar.offsetHeight - 8)}px`
    bar.style.left = `${Math.max(8, Math.min(innerWidth - bar.offsetWidth - 8, r.left + r.width / 2 - bar.offsetWidth / 2))}px`
  })
  return (
    <div
      id="vcBar"
      ref={ref}
      hidden
      role="toolbar"
      aria-label="On the selected text"
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()} // a press keeps the selection
      className="fixed z-[65] flex rounded-full bg-zinc-900 p-1 shadow-lg ring-1 ring-black/10 dark:bg-zinc-100 dark:ring-white/10"
    >
      <button
        id="cmtBtn"
        data-act="doc-comment-sel"
        hidden={!cmt}
        className="flex h-9 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"
      >
        <Icon n="comment" c="size-4" />
        Comment
      </button>
      <button
        id="vcBtn"
        data-act="vc"
        {...(on ? { 'data-on': '' } : {})}
        aria-label={
          on
            ? 'Stop: the quote and the voice note go into the box'
            : 'Voice comment: record a comment on the selected text'
        }
        className="flex h-9 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-white/15 data-on:bg-red-600 data-on:text-white dark:text-zinc-900 dark:hover:bg-zinc-900/10 dark:data-on:bg-red-600 dark:data-on:text-white"
      >
        {on ? (
          <>
            <span className="size-2 animate-pulse rounded-full bg-white" />
            Stop
          </>
        ) : (
          <>
            <Icon n="mic" c="size-4" />
            Voice comment
          </>
        )}
      </button>
      <button
        id="fixBtn"
        data-act="vc-fix"
        hidden={!fix}
        aria-label="Correct: write the right words for the selected ones"
        className="flex h-9 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"
      >
        <Icon n="pencil" c="size-4" />
        Correct
      </button>
    </div>
  )
}
