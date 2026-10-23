// An item as a page of its own (T57): back, code and status on top, the rarely used things behind ⋯. Reading order:
// title, what it needs from you, description, files, documents, subitems, conversation. On the desktop it is the pane
// beside the list (I70), which also shows a document (T110), an input (T274 #9) or the New input page (B73).
import type { IconName } from '../lib/icons'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  CHIP,
  DONE_OTHER,
  DONE_PICK,
  FIELD,
  MODIFY_LINK,
  NEED,
  PRIMARY,
  PRIMARY_BASE,
  SECOND,
  TYPE_TEXT,
} from '../lib/constants'
import {
  CLOSED,
  D,
  U,
  bump,
  byN,
  byR,
  liveN,
  code,
  desk,
  docById,
  docsOf,
  els,
  filesOf,
  kids,
  lastAgentMsg,
  markSeen,
  model,
  needsYou,
  canDone,
  statusName,
  useArea,
  msgName,
  userWord,
  detailShown,
  type Go,
} from '../lib/state'
import type { Item, Msg } from '../lib/types'
import { hasChoices, inlineMd, clean } from '../lib/markdown'
import { keepGo } from '../lib/go'
import { noteText } from '../lib/docs'
import { kept } from '../lib/drafts'
import { Icon, Kbd, SectionHead, StateIcon } from './ui'
import {
  DocCard,
  FileRows,
  KeepBtn,
  MsgText,
  NeedFrame,
  Rich,
  SendAnswerBtn,
  Talk,
  Thumbs,
  answeredLast,
  docNotes,
} from './Talk'
import { DocEdit, DocPaneActs, DocPaneHead, DocPaneNav, DocView } from './Doc'
import { InputPane, InputPaneHead } from './Inputs'
import { DeletedView } from './SideList'

// The message the needs card shows: the question, or the agent's report or proposal (then not repeated below).
export const cardMsg = (it: Item): Msg | null =>
  it.wait
    ? it.thread.find((x) => x.id === it.wait?.id) || (it.wait as unknown as Msg)
    : (it.status === 'review' || it.status === 'proposed') && !it.reply
      ? lastAgentMsg(it) || null
      : null // B299
// B299: approving or accepting stays one tap away while the agent has the item back or a question is open
// T438 #5: the card of what you decided on a proposal or finished work, from the item itself (so after a reload, in
// another tab, archived, the same); a question you answered keeps its own card instead, its button showing your choice
function decidedCard(it: Item): { dec: NonNullable<Item['decided']>; x: Msg | undefined } | null {
  const dec = it.decided
  if (!dec || it.status === dec.from || it.wait) return null
  if ((lastAgentMsg(it)?.id ?? null) !== dec.msg) return null // the agent spoke since: your decision is history now
  const x = it.thread.find((y) => y.id === dec.msg)
  if (x && x.kind === 'ask' && hasChoices(x.text)) return null
  return { dec, x }
}
// What waits on you, as a card (T65): the question with its choices, the proposal, the finished work.
export function NeedsCard({ it, onCard = false }: { it: Item; onCard?: boolean }) {
  const n = it.n,
    m = cardMsg(it),
    name = msgName(m || it.wait || { by: it.by && it.by !== 'you' ? it.by : 'agent' })
  // F428 (P0): the same frame as the card it becomes once answered (NeedFrame), so nothing moves
  const card = (icon: IconName, title: string, body: ReactNode, buttons: ReactNode, hint = '') => (
    <NeedFrame icon={icon} title={title} t={m?.t} body={body} foot={buttons} hint={hint} />
  )
  if (it.wait) {
    const w = it.wait,
      choices = w.kind === 'ask' && hasChoices(w.text)
    const body = (
      <>
        <Rich text={w.text} gid={'ask' + n} cls="text-zinc-900 dark:text-zinc-100" form={w.kind === 'ask' ? n : 0} />
        {w.files?.length ? (
          <div className="flex gap-2 overflow-x-auto lg:scrollbar-thin">
            <Thumbs files={w.files} gid={'w' + n} size="h-48 w-24" />
          </div>
        ) : null}
      </>
    )
    const keep = it.status === 'proposed' || it.status === 'review'
    return card(
      w.kind === 'block' ? 'alert' : 'ask',
      `${msgName(w)} ${w.kind === 'block' ? 'is blocked and needs you' : 'asks you'}`,
      body,
      keep || choices ? (
        <>
          <KeepBtn it={it} />
          {choices ? <SendAnswerBtn n={n} cls={onCard ? 'flex-1' : 'flex-[1.4] lg:flex-none'} keyHint /> : null}
        </>
      ) : null, // T274 #29, B299
      choices ? '' : '↓ Answer below', // T365 #3: the keys are on the choices and the button
    )
  }
  const dc = decidedCard(it)
  if (dc) {
    // F428 (P0): what you decided stays in its card, where it was: grey, what you chose, and Modify to choose again
    const { dec, x } = dc
    const re = U.remodify === n, // T438 #6: Modify: the two buttons work again; the one you chose before just closes it
      chose = (v: string) => dec.to === v || (v === 'open' && dec.from === 'proposed' && dec.to !== 'dropped')
    if (re)
      return (
        <NeedFrame
          icon={dec.from === 'proposed' ? 'propose' : 'done'}
          title={`${msgName(x || { by: it.by && it.by !== 'you' ? it.by : 'agent' })} ${dec.from === 'proposed' ? 'proposed this' : 'finished this'}`}
          t={x?.t}
          act={
            <button
              data-act="decided-modify-cancel"
              className={MODIFY_LINK.replace(/lg:opacity-0\S*|lg:group-hover\S*/g, '')}
            >
              Cancel
            </button>
          }
          body={x ? <MsgText x={x} gid={'dec' + n} whole /> : null}
          foot={
            <>
              {(dec.from === 'proposed'
                ? ([
                    ['status', 'dropped', 'ban', "Won't do", 'W'],
                    ['status', 'open', 'thumb', 'Approve', 'A'],
                  ] as const satisfies readonly (readonly [string, string, IconName, string, string])[])
                : ([
                    ['reopen', 'doing', 'reopen', 'Not yet', 'N'],
                    ['status', 'done', 'check', 'Accept', 'A'],
                  ] as const satisfies readonly (readonly [string, string, IconName, string, string])[])
              ).map(([act, v, icon, label, k], i) => (
                <button
                  key={v}
                  data-act={chose(v) ? 'decided-modify-cancel' : act}
                  data-n={n}
                  data-v={v}
                  className={`${i ? `${PRIMARY_BASE} ${NEED[dec.from === 'proposed' ? 'approve' : 'accept'].btn} flex-[1.4]` : `${SECOND} flex-1`} lg:flex-none`}
                >
                  <Icon n={icon} c={i ? 'size-4.5' : 'size-4'} sw="2.25" />
                  {label}
                  <Kbd k={k} />
                </button>
              ))}
            </>
          }
        />
      )
    return (
      <NeedFrame
        icon={dec.from === 'proposed' ? 'propose' : 'done'}
        title={`${msgName(x || { by: it.by && it.by !== 'you' ? it.by : 'agent' })} ${dec.from === 'proposed' ? 'proposed this' : 'finished this'}`} // T438 #5 (C7): the same name as before you decided
        t={x?.t}
        done
        act={
          <button data-act="decided-modify" data-n={n} className={MODIFY_LINK}>
            Modify
          </button>
        }
        body={x ? <MsgText x={x} gid={'dec' + n} whole /> : null}
        foot={
          // F428, R369 review: the two buttons stay where they were, yours ticked and the other quieter; T438 #3: the
          // same size too (the key's room is kept), and nothing takes their place
          <>
            {(dec.from === 'proposed'
              ? ([
                  ['dropped', 'ban', "Won't do", 'W'],
                  ['open', 'thumb', 'Approve', 'A'],
                ] as const satisfies readonly (readonly [string, IconName, string, string])[])
              : ([
                  ['doing', 'reopen', 'Not yet', 'N'],
                  ['done', 'check', 'Accept', 'A'],
                ] as const satisfies readonly (readonly [string, IconName, string, string])[])
            ).map(([v, icon, label, k], i) => (
              <span
                key={v}
                className={`${dec.to === v || (v === 'open' && dec.to === 'doing' && dec.from === 'proposed') ? DONE_PICK : DONE_OTHER} ${i ? 'flex-[1.4] font-semibold' : 'flex-1 font-medium'} lg:flex-none`}
              >
                <Icon n={dec.to === v ? 'check' : icon} c={i ? 'size-4.5' : 'size-4'} sw="2.25" />
                {label}
                <span className="invisible">
                  <Kbd k={k} />
                </span>
              </span>
            ))}
          </>
        }
      />
    )
  }
  if (answeredLast(it)) return null // F428: the answered question's card holds Approve / Accept, where it was
  // B471: you wrote instead of deciding: the card stays, Skipped, and Approve or Accept is still one tap (B299)
  const said = it.thread.at(-1)
  if ((it.status === 'proposed' || it.status === 'review') && (it.reply || (said && userWord(said))))
    return card(
      it.status === 'proposed' ? 'propose' : 'done',
      `${name} ${it.status === 'proposed' ? 'proposed this' : 'finished this'}`,
      m && !it.reply ? <MsgText x={m} gid={'card' + n} whole /> : null,
      <>
        {/* B485: what you did (you replied) stands out; Approve / Accept waits quietly, itself again under the pointer */}
        <span className={`${DONE_PICK} flex-1 font-semibold lg:flex-none`}>
          <Icon n="reply" c="size-4" sw="2.25" />
          Skipped · you replied
        </span>
        <KeepBtn it={it} quiet />
      </>,
    )
  if (it.status === 'proposed')
    return card(
      'propose',
      `${name} proposed this`,
      m ? <MsgText x={m} gid={'card' + n} whole /> : null, // T365 #12
      <>
        <button data-act="status" data-n={n} data-v="dropped" className={`${SECOND} flex-1 lg:flex-none`}>
          <Icon n="ban" c="size-4" />
          Won&apos;t do
          <Kbd k="W" />
        </button>
        <button
          data-act="status"
          data-n={n}
          data-v="open"
          className={`${PRIMARY_BASE} ${NEED.approve.btn} flex-[1.4] lg:flex-none`}
        >
          <Icon n="thumb" c="size-4.5" />
          Approve
          <Kbd k="A" />
        </button>
      </>,
      '', // T365 #12
    )
  if (it.status === 'review')
    return card(
      'done',
      `${name} finished this`,
      m ? <MsgText x={m} gid={'card' + n} whole /> : null, // T365 #12
      <>
        <button data-act="reopen" data-n={n} className={`${SECOND} flex-1 lg:flex-none`}>
          <Icon n="reopen" c="size-4" />
          Not yet
          <Kbd k="N" />
        </button>
        <button
          data-act="status"
          data-n={n}
          data-v="done"
          className={`${PRIMARY_BASE} ${NEED.accept.btn} flex-[1.4] lg:flex-none`}
        >
          <Icon n="check" c="size-4.5" sw="2.25" />
          Accept
          <Kbd k="A" />
        </button>
      </>,
      '', // T365 #2: the two buttons say it
    )
  return null // B321: that you replied is said once, at the top ("Your agent's turn")
}
export const statusTone = (it: Item) =>
  it.status === 'doing'
    ? 'text-blue-600 dark:text-blue-400'
    : needsYou(it)
      ? 'text-amber-600 dark:text-amber-400'
      : it.status === 'done'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-zinc-500 dark:text-zinc-400'
const Inline = ({ text }: { text: string }) => (
  <span
    className="min-w-0 break-words text-zinc-700 dark:text-zinc-300"
    dangerouslySetInnerHTML={{ __html: clean(inlineMd(text)) }}
  />
)

// The item editor: its fields are the page's (lib/edit.ts reads them); what you typed survives a redraw (T113 A6).
function Editor({ it }: { it: Item }) {
  const k = kept('edits')[it.n] as { title: string; body: string; next: string } | undefined
  return (
    <div className="flex flex-col gap-2">
      <input id="eTitle" className={`${FIELD} font-medium`} defaultValue={k?.title ?? it.title} aria-label="Title" />
      <textarea
        id="eBody"
        rows={8}
        className={`${FIELD} leading-relaxed`}
        aria-label="Details"
        placeholder="Details"
        defaultValue={k?.body ?? it.body}
      />
      <input
        id="eNext"
        className={FIELD}
        defaultValue={k?.next ?? it.next}
        aria-label="Next step"
        placeholder="Next step (optional)"
      />
      <div className="flex justify-end gap-2">
        <button data-act="edit-cancel" className={SECOND}>
          Cancel
        </button>
        <button data-act="edit-save" data-n={it.n} className={PRIMARY}>
          Save
        </button>
      </div>
    </div>
  )
}
// F395, T423: a pane wide enough (1100px or more) where the item does not fit above or its talk does not fit below
// shows the item (or its open document) on the left and its talk on the right, so nothing has to hide behind a scroll
// stuck: the item has been in two columns since it (or the item before it) opened: a width going and coming back
// finds it in two columns again (r749), as content changing at one width keeps them (r743)
export const DUO = { on: false, min: 1100, stuck: false }
const NEEDS_SEEN = { n: 0, on: false } // A3 (T422): the item shown, and whether its card asked you
export function ItemPage({ it, left = null, bare = false }: { it: Item; left?: ReactNode; bare?: boolean }) {
  const duo = DUO.on
  const talkRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    els.talk = talkRef.current // T322: what scrolls the talk on the desktop
    const top = document.getElementById('itemClip')
    if (top) markOver(top)
  })
  const asks = needsYou(it)
  useLayoutEffect(() => {
    // A3 (T422): the card that asks you comes back (an Undo, a change put back): the talk shows it, at its end
    const talk = talkRef.current
    if (asks && NEEDS_SEEN.n === it.n && !NEEDS_SEEN.on && talk) talk.scrollTop = talk.scrollHeight
    Object.assign(NEEDS_SEEN, { n: it.n, on: asks })
  }, [asks, it.n])
  useLayoutEffect(() => {
    // dragging the line changes how much of the item fits; the fade follows at once
    const top = document.getElementById('itemClip')
    if (!top || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => markOver(top))
    ro.observe(top)
    if (top.firstElementChild) ro.observe(top.firstElementChild)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    // the talk at its latest message stays there when the item part above grows or shrinks
    const talk = talkRef.current
    if (!talk || typeof ResizeObserver === 'undefined') return
    let atEnd = true
    const seen = () => (atEnd = talk.scrollTop + talk.clientHeight >= talk.scrollHeight - 4)
    const ro = new ResizeObserver(() => {
      if (atEnd) talk.scrollTop = talk.scrollHeight
      moreBelow(talk)
    })
    talk.addEventListener('scroll', seen, { passive: true })
    ro.observe(talk)
    return () => {
      ro.disconnect()
      talk.removeEventListener('scroll', seen)
    }
  }, [])
  const n = it.n,
    files = filesOf(it),
    children = kids.get(n) || [],
    parent = it.parent ? byN.get(it.parent) : undefined,
    shown = cardMsg(it),
    srcs = it.srcs.filter((id) => byR.get(id)?.kind !== 'answer'), // F428: an answer to its question is not where it came from
    decided = decidedCard(it)?.dec.msg ?? null // F428: its message is in the decided card, once
  // T438 #12 (A8): the card that waits on you (or that you decided) sits where its message is in time, so what came
  // after it (your note, a comment on a document) reads after it
  const cardId = it.wait?.id ?? (answeredLast(it) ? null : shown?.id) ?? decided ?? null, // an answered question is drawn by the talk
    thread = it.thread.filter((x) => x.id !== it.wait?.id || x.id === cardId),
    hidden = U.more.has(n) ? 0 : Math.max(0, thread.length - 8),
    inline = cardId != null && thread.slice(hidden).some((x) => x.id === cardId)
  const caret = <Icon n="down" c="size-3 opacity-50" sw="2.25" />
  // T274 #10: the properties in one row, each one a tap away: status, priority, type, now or later
  const chips = (
    <>
      <button
        data-act="item-menu"
        data-arm="s"
        title="Status · S"
        className={`${CHIP} min-w-32 shrink-0 text-zinc-700 dark:text-zinc-200`} // T438 #14 (C8): one width, so the chips after it stay put
      >
        <StateIcon s={it.status} label={statusName(it)} cls="size-3.5" />
        {statusName(it)}
        {caret}
      </button>
      {it.type === 'rule' ? null : (
        <button
          data-act="item-menu"
          data-arm="p"
          title="Priority · P"
          className={`${CHIP} shrink-0 ${it.pri === 'P0' ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-zinc-700 dark:text-zinc-200'}`}
        >
          {it.pri}
          {caret}
        </button>
      )}
      {it.type === 'rule' ? null : (
        <button
          data-act="item-menu"
          data-arm="t"
          title="Type · T"
          className={`${CHIP} shrink-0 text-zinc-700 dark:text-zinc-200`}
        >
          {it.type[0].toUpperCase() + it.type.slice(1)}
          {caret}
        </button>
      )}
      {CLOSED(it.status) || it.type === 'rule' ? null : (
        <button
          data-act="swipe"
          data-n={n}
          data-f="when"
          data-v={it.when === 'later' ? 'now' : 'later'}
          title={`${it.when === 'later' ? 'Back to now' : 'Later'} · L`}
          className={`${CHIP} shrink-0 text-zinc-700 dark:text-zinc-200`}
        >
          <Icon n="clock" c="size-3.5 opacity-60" />
          {it.when === 'later' ? 'Later' : 'Now'}
        </button>
      )}
      {it.archived ? (
        <span className={`${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300`}>
          <Icon n="archive" c="size-3.5 opacity-60" />
          Archived
        </span>
      ) : null}
      {srcs.length ? (
        <button data-act="sources" data-n={n} className={`${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300`}>
          {srcs.length === 1 ? 'From 1 input' : `From ${srcs.length} inputs`}
        </button>
      ) : null}
      {parent ? (
        <button
          data-act="goto"
          data-n={parent.n}
          className={`${CHIP} min-w-0 flex-1 basis-32 text-zinc-700 dark:text-zinc-300`}
        >
          <Icon n="link" c="size-3.5 opacity-60" />
          <span className="truncate">
            {/* F480: what it belongs to, and a way there */}
            <span className="mr-1 text-zinc-500 dark:text-zinc-400">Part of</span>
            <span className={`mr-1 font-mono font-bold ${TYPE_TEXT[parent.type]}`}>{code(parent.n)}</span>
            {parent.title}
          </span>
        </button>
      ) : null}
    </>
  )
  const head =
    U.editing === n ? (
      <Editor key={n} it={it} />
    ) : (
      <div className="flex flex-col gap-3">
        <h1
          className={`text-[22px] leading-[1.35] font-semibold break-words ${it.status === 'dropped' ? 'line-through' : ''}`}
        >
          {it.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">{chips}</div>
      </div>
    )
  const desc =
    U.editing !== n && (it.body || it.next) ? (
      <div className="flex flex-col gap-3">
        {it.body ? <Rich text={it.body} gid={'body' + n} cls="text-base text-zinc-800 dark:text-zinc-200" /> : null}
        {it.next ? (
          <div className="flex gap-2 text-sm">
            <span className="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Next</span>
            <Inline text={it.next} />
          </div>
        ) : null}
      </div>
    ) : null
  const docs = docsOf(n)
  const notes = docNotes(n, hidden ? thread[hidden]?.t : '') // T274 #4
  // T322 (design A, with B's handle): on the desktop the item and its talk are two parts, each scrolling on its own,
  // with a clear line between them. The talk opens at its latest message. The phone keeps one page that scrolls.
  // B346, B351: the line stays where you put it, the same for every item, so switching items moves nothing; an item
  // longer than its part scrolls there and fades while more is below; shorter, the rest is empty (no height of its own)
  return (
    <div
      id="itemPage"
      className={`group/item flex flex-col gap-6 px-5 pt-5 pb-10 lg:h-full lg:gap-0 lg:p-0 ${duo ? 'lg:flex-row' : ''}`}
    >
      {duo && left ? (
        <div
          id="itemTop"
          className={`lg:h-full lg:w-[var(--duo-w,55%)] lg:shrink-0 lg:scrollbar-thin lg:overflow-y-auto ${bare ? '' : 'lg:px-8 lg:pt-8 lg:pb-12'}`}
        >
          {left}
        </div>
      ) : (
        <div
          id="itemTop"
          className={`flex flex-col lg:shrink-0 ${duo ? 'lg:h-full lg:w-[var(--duo-w,55%)]' : 'lg:h-[var(--top-h,40%)]'}`}
        >
          <div
            id="itemClip"
            data-clip
            onScroll={(e) => markOver(e.currentTarget)}
            className="lg:min-h-0 lg:scrollbar-thin lg:overflow-y-auto lg:data-over:mask-b-from-[calc(100%-4rem)]"
          >
            <div className={`flex flex-col gap-6 lg:mx-auto lg:w-full lg:max-w-[46rem] lg:px-8 lg:pt-7 lg:pb-6`}>
              {head}
              {desc}
              {/* F332: the documents are part of the item: they stay in view while the talk scrolls */}
              {docs.length ? (
                <section className="flex flex-col gap-2">
                  <SectionHead text="Documents" />
                  {docs.map((d) => (
                    <DocCard key={d.d} d={d} />
                  ))}
                </section>
              ) : null}
              {files.length ? <FileRows files={files} gid={'item' + n} size="h-24 w-16" /> : null}
              {children.length || U.subFor === n ? (
                <section className="flex flex-col gap-2">
                  <SectionHead
                    text={`Subitems${children.length ? ` · ${children.filter((k) => CLOSED(k.status)).length}/${children.length}` : ''}`}
                    right={
                      U.subFor === n ? null : (
                        <button
                          data-act="sub-new"
                          data-n={n}
                          className="-my-2.5 flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10"
                        >
                          <Icon n="plus" c="size-4" sw="2" />
                          Add
                        </button>
                      )
                    }
                  />
                  {children.length ? (
                    <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                      {children.map((k) => (
                        <button
                          key={k.n}
                          data-act="goto"
                          data-n={k.n}
                          className={`flex w-full items-start gap-3 px-3 py-3 text-left first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-50 data-pressed:bg-zinc-100 dark:hover:bg-zinc-900 dark:data-pressed:bg-zinc-800 ${CLOSED(k.status) ? 'opacity-55' : ''}`}
                        >
                          <StateIcon s={k.status} label={statusName(k)} />
                          <span
                            className={`min-w-0 flex-1 text-[15px] leading-snug ${CLOSED(k.status) ? 'line-through' : ''}`}
                          >
                            <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[k.type]}`}>
                              {code(k.n)}
                            </span>
                            {k.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {U.subFor === n ? (
                    <div className="flex items-center gap-2">
                      <input
                        id="subTitle"
                        className={`${FIELD} min-w-0 flex-1`}
                        placeholder={`Subitem of ${code(n)}`}
                        aria-label="Subitem title"
                      />
                      <button data-act="sub-add" data-n={n} className={PRIMARY}>
                        Add
                      </button>
                      <button
                        data-act="sub-cancel"
                        aria-label="Cancel"
                        className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Icon n="x" c="size-5" />
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {duo ? (
        // F395: the line between the two columns, dragged sideways like the other lines
        <div
          data-grip="duo"
          className="group/line relative z-10 hidden w-px shrink-0 cursor-col-resize bg-zinc-200 after:absolute after:-inset-x-1.5 after:inset-y-0 lg:block dark:bg-zinc-800"
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-blue-500 opacity-0 transition-opacity group-hover/line:opacity-100 group-hover/line:delay-150 group-data-drag/line:opacity-100" />
        </div>
      ) : (
        <div
          data-grip="top"
          className="group/line relative z-10 hidden h-px shrink-0 cursor-row-resize bg-zinc-200 after:absolute after:inset-x-0 after:-inset-y-2 lg:block dark:bg-zinc-800"
        >
          {/* B357: every line you can drag looks the same: pointed at or dragged, the line itself turns blue */}
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-blue-500 opacity-0 transition-opacity group-hover/line:opacity-100 group-hover/line:delay-150 group-data-drag/line:opacity-100" />
        </div>
      )}
      <div
        id="itemTalk"
        ref={talkRef}
        onScroll={(e) => moreBelow(e.currentTarget)}
        // B495: in two columns they run to the bottom of the screen, so the line between them is one line from top to
        // bottom; the talk ends clear above the box
        className={`lg:min-h-0 lg:flex-1 lg:scrollbar-thin lg:overflow-y-auto lg:data-up:mask-t-from-[calc(100%-2rem)] ${duo ? 'lg:h-full lg:min-w-0 lg:pb-[calc(var(--foot-h,0px)+1.5rem)]' : ''}`}
      >
        <div className="flex flex-col gap-6 lg:mx-auto lg:w-full lg:max-w-[46rem] lg:px-8 lg:py-6">
          {thread.length || notes.length ? (
            <div className="flex flex-col gap-6 border-t border-zinc-100 pt-6 lg:border-0 lg:pt-0 dark:border-zinc-800/70">
              {hidden ? (
                <button
                  data-act="more"
                  data-n={n}
                  className="-my-1 h-11 self-center rounded-lg px-3 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10"
                >
                  Show {hidden} earlier
                </button>
              ) : null}
              <Talk
                it={it}
                list={thread.slice(hidden)}
                notes={notes}
                card={inline && cardId != null ? { id: cardId, node: <NeedsCard it={it} /> } : undefined}
              />
            </div>
          ) : null}
          {inline ? null : <NeedsCard it={it} />}
        </div>
      </div>
    </div>
  )
}
// B345: the talk fades at its bottom only while more of it is below, out of sight
const moreBelow = (el: HTMLElement) => {
  el.toggleAttribute('data-more', overflows(el))
  el.toggleAttribute('data-up', el.scrollTop > 2) // and at its top while some of it is above, so a cut message does not run into the line
}
// T322: the item part is taller than its share: it fades while more of it is below
const overflows = (el: HTMLElement) => el.scrollTop + el.clientHeight < el.scrollHeight - 2
function markOver(clip: HTMLElement) {
  clip.toggleAttribute('data-over', overflows(clip))
}
// The item's header line: its code and where it stands (T230 #2: a state, the card's and the row's word)
const ItemHead = ({ it }: { it: Item }) => (
  <>
    <span className="hidden lg:inline">
      <StateIcon s={it.status} label={statusName(it)} cls="size-[18px]" />
    </span>
    <span className={`font-mono text-sm font-bold ${TYPE_TEXT[it.type]}`}>{code(it.n)}</span>
    <span className="text-[11px] font-semibold tracking-wider uppercase">
      {
        it.wait ? (
          <span className="text-amber-600 dark:text-amber-400">
            {it.wait.kind === 'block' ? 'Blocked' : 'Asks you'}
          </span>
        ) : it.reply && !CLOSED(it.status) ? (
          <span className="text-blue-600 dark:text-blue-400">Your agent&apos;s turn</span> // B321: you replied
        ) : null /* T438 #11: its status is the chip under the title: not said twice */
      }
    </span>
  </>
)
const BarIcon = ({ act, icon, title }: { act: string; icon: IconName; title: string }) => (
  <button
    data-act={act}
    title={title}
    aria-label={title.split(' · ')[0]}
    className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
  >
    <Icon n={icon} c="size-[18px]" />
  </button>
)
const BarText = ({
  act,
  icon,
  label,
  title,
  data,
}: {
  act: string
  icon: IconName
  label: string
  title: string
  data: Record<string, string | number>
}) => (
  <button
    data-act={act}
    {...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v]))}
    title={title}
    className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
  >
    <Icon n={icon} c="size-4" />
    {label}
  </button>
)
// T274 #26: the actions you use, with their words, first; Copy for agent is in ⋯ (and Shift-C)
function ItemActs({ it }: { it: Item }) {
  return (
    <>
      {/* T475: only what applies, side by side (no empty room where one does not) */}
      {it.type === 'rule' || !canDone(it) ? null : (
        <BarText act="status" icon="check" label="Done" title="Done · D" data={{ n: it.n, v: 'done' }} />
      )}
      {it.type === 'rule' || it.archived || CLOSED(it.status) ? null : (
        <>
          <BarText
            act="swipe"
            icon="clock"
            label={it.when === 'now' ? 'Later' : 'Back to now'}
            title={it.when === 'now' ? 'Later · L' : 'Back to now · L'}
            data={{ n: it.n, f: 'when', v: it.when === 'now' ? 'later' : 'now' }}
          />
        </>
      )}
      {it.archived ? (
        <BarText act="archive" icon="unarchive" label="Unarchive" title="Unarchive · E" data={{ n: it.n, on: '0' }} />
      ) : (
        <BarText act="archive" icon="archive" label="Archive" title="Archive · E" data={{ n: it.n, on: '1' }} />
      )}
    </>
  )
}
const ItemNav = () => (
  <>
    {U.go ? (
      U.open != null && U.go.list.includes(U.open) ? null : (
        // T438 #9: paused (you opened something else while going through): the way back, in the bar, not a banner
        <button
          data-act="go-resume"
          className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-amber-50 pr-2 pl-3 text-[13px] font-semibold text-amber-800 hover:bg-amber-100 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
        >
          Going through · Back to it
          <Kbd k="⇧J" />
        </button>
      )
    ) : (
      <>
        <BarIcon act="prev" icon="chevup" title="Previous · K" />
        <BarIcon act="next" icon="down" title="Next · J" />
      </>
    )}
    <BarIcon
      act="full"
      icon={D.full ? 'shrink' : 'open'}
      title={D.full ? 'Back to the list · Esc' : 'Full width · O'}
    />
  </>
)
// Going through what needs you on the desktop: an amber strip on the detail pane (T113 A13, B17)
function GoStrip({ g }: { g: Go }) {
  const i = g.list.indexOf(U.open ?? -1),
    here = i >= 0,
    at = g.list.indexOf(g.at ?? -1)
  const b = (act: string, label: string, key: string) => (
    <button
      data-act={act}
      className="flex h-8 items-center gap-1 rounded-lg px-2 font-medium text-zinc-700 hover:bg-amber-100 dark:text-zinc-200 dark:hover:bg-amber-400/15"
    >
      {label}
      <Kbd k={key} />
    </button>
  )
  return (
    <div
      id="goStrip"
      className="flex h-11 shrink-0 items-center gap-3 border-b border-amber-200/70 bg-amber-50 px-4 text-[13px] dark:border-amber-400/15 dark:bg-amber-400/10"
    >
      <span className="shrink-0 text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-amber-400">
        Going through
      </span>
      <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {here ? `${i + 1} of ${g.list.length}` : `paused at ${at + 1} of ${g.list.length}`}
      </span>
      <span className="flex w-40 shrink-0 gap-1">
        {g.list.map((k) => (
          <span
            key={k}
            className={`h-1 flex-1 rounded-full ${k === g.at ? (here ? 'bg-amber-500 dark:bg-amber-400' : 'bg-amber-300 dark:bg-amber-400/50') : g.done.has(k) ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          />
        ))}
      </span>
      {g.hidden ? (
        <span className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
          · {g.hidden} more hidden by your {g.by}
        </span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {here ? (
          <>
            {b('go-prev', 'Previous', '⇧K')}
            {b('go-next', g.done.has(U.open ?? -1) ? 'Next' : 'Skip', '⇧J')}
          </>
        ) : (
          b('go-resume', 'Back to it', '⇧J')
        )}
        {b('go-end', 'End', 'Esc')}
      </span>
    </div>
  )
}
function NoSelection() {
  if (U.side === 'deleted') return <DeletedView /> // B430: the deleted thing you clicked, with Restore
  if (U.side)
    // T402: beside Documents, Activity or Deleted the pane waits for what you open there; T438 #16: and says so
    return (
      <div className="grid h-full place-items-center p-8 text-center text-[15px] text-zinc-500 dark:text-zinc-400">
        {U.side === 'docs' ? 'Pick a document to read it here' : 'Select a line to view'}
      </div>
    )
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <p className="text-[15px] text-zinc-500 dark:text-zinc-400">Select an item or type below</p>
        <p className="mt-2 flex items-center justify-center gap-1 text-[13px] text-zinc-400">
          <Kbd k="J" />
          <Kbd k="K" />
          <span className="ml-1">to move</span>
          {model.S.items.some(needsYou) ? (
            <>
              <span>·</span>
              <Kbd k="⇧J" />
              <span className="ml-1">to go through what needs you</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
// What the pane shows now, its header, its actions, its way back.
function paneParts(): { head: ReactNode; acts: ReactNode; nav: ReactNode; menu: boolean; body: ReactNode } {
  const it = U.open ? byN.get(U.open) : undefined
  if (desk()) {
    const d = U.doc ? docById(U.doc) : undefined
    const dIt = d ? byN.get(liveN(d.n)) : undefined
    if (d && !U.docEdit && DUO.on && dIt)
      // F395: wide: the document on the left, its item's talk on the right
      return {
        head: <DocPaneHead d={d} editing={false} />,
        acts: <DocPaneActs d={d} />,
        nav: <DocPaneNav d={d} />,
        menu: false,
        body: <ItemPage it={dIt} left={<DocView d={d} />} bare={d.fmt === 'html'} />,
      }
    if (d && !U.docEdit)
      return {
        head: <DocPaneHead d={d} editing={false} />,
        acts: <DocPaneActs d={d} />,
        nav: <DocPaneNav d={d} />,
        menu: false,
        body: (
          // B492: a web page brings its own margins: Taska adds none around it
          <div className={d.fmt === 'html' ? 'w-full' : 'w-full px-8 pt-8 pb-12'}>
            <DocView d={d} />
          </div>
        ),
      }
    if (d && U.docEdit)
      return {
        head: <DocPaneHead d={d} editing />,
        acts: null,
        nav: null,
        menu: false,
        body: (
          <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col px-8 pt-4 pb-12">
            <DocEdit key={'e' + d.d} d={d} md={U.docText ?? noteText(d)} />
          </div>
        ),
      }
    if (U.tab === 'inputs' && !D.page)
      return { head: <InputPaneHead />, acts: null, nav: null, menu: false, body: <InputPane /> }
    if (!it) {
      const back = D.compose && D.prev && byN.has(D.prev)
      return {
        head: D.compose ? (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />
            New input
          </span>
        ) : null,
        acts: null,
        nav: back ? (
          <button
            data-act="compose-back"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Icon n="left" c="size-4" />
            Back to {D.prevDoc ? 'D' + D.prevDoc : code(D.prev as number)}
            <Kbd k="Esc" />
          </button>
        ) : null,
        menu: false,
        body: D.compose ? null : <NoSelection />,
      }
    }
  }
  if (!it) return { head: null, acts: null, nav: null, menu: false, body: null }
  return {
    head: <ItemHead it={it} />,
    acts: desk() ? <ItemActs it={it} /> : null,
    nav: desk() ? <ItemNav /> : null,
    menu: true,
    body: <ItemPage key={it.n} it={it} />,
  }
}
export function DetailView({ hidden, place = '' }: { hidden: boolean; place?: string }) {
  useArea('detail')
  const body = useRef<HTMLDivElement>(null)
  const parts = paneParts()
  const it = U.open ? byN.get(U.open) : undefined
  const g = U.go
  if (g && U.open != null && g.list.includes(U.open)) g.at = U.open
  // T438 #9 (B7): the strip only while you are on one of its items; paused, the list says so in its header instead
  const strip = !!(g && desk() && !D.compose && U.open != null && g.list.includes(U.open))
  const shownDoc = desk() && U.doc && !U.docEdit ? U.doc : null
  useLayoutEffect(() => {
    // a document opens where you left it, or at its top (not where its item was scrolled)
    if (shownDoc && body.current) body.current.scrollTop = U.docScroll[shownDoc] || 0
  }, [shownDoc])
  useLayoutEffect(() => {
    // F395: two columns while the pane is wide and shows an item (or its document)
    const el = body.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => {
      // r507, T423: the item does not fit the part above, or its talk does not fit the part below (where you put the
      // line between them, 40% by default), and the pane is wide
      const top = document.getElementById('itemClip') || document.getElementById('itemTop'),
        talk = document.getElementById('itemTalk'),
        H = el.clientHeight,
        set = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')),
        upper = set > 0 ? Math.min(set, H) : H * 0.4
      const high =
        ((top?.firstElementChild as HTMLElement | null)?.offsetHeight || 0) > upper ||
        ((talk?.firstElementChild as HTMLElement | null)?.offsetHeight || 0) > H - upper
      // B505 (#6505): a document on the desktop is always beside its item's conversation, which holds its comments
      const docShown = !!U.doc && !U.docEdit
      // B539 (r743, #6525): once two columns, they stay while an item is open: a fold, a reply or another item that would
      // fit in one never takes the page back to one column; a pane too narrow shows one, and the same width again
      // shows two again, however the width went (r749)
      const shows = !!U.open && !D.compose && !D.page && U.tab !== 'inputs'
      if (!shows) DUO.stuck = false
      const on = desk() && shows && (docShown || (el.clientWidth >= DUO.min && (high || DUO.stuck)))
      if (on && !docShown) DUO.stuck = true
      document.getElementById('app')?.toggleAttribute('data-duo', on)
      if (on !== DUO.on) {
        DUO.on = on
        bump('detail')
      }
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    // what is in either part grows or shrinks too (a message comes, a picture loads)
    for (const id of ['itemClip', 'itemTop', 'itemTalk']) {
      const c = document.getElementById(id)?.firstElementChild
      if (c) ro.observe(c)
    }
    return () => ro.disconnect()
  })
  useLayoutEffect(() => {
    els.detailBody = body.current
    if (desk()) keepGo()
    if (it && model.S.project && (!desk() || detailShown())) markSeen(it) // T274 #5: seen once it shows
    body.current
      ?.querySelectorAll<HTMLElement>('[data-clip]')
      .forEach((el) => el.toggleAttribute('data-over', el.scrollTop + el.clientHeight < el.scrollHeight - 2))
  })
  return (
    <section id="detailView" hidden={hidden} className={`flex min-h-0 flex-1 flex-col ${place}`}>
      {strip && g ? <GoStrip g={g} /> : null}
      <header
        className={`flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-1 lg:border-zinc-200 lg:px-3 dark:border-zinc-800/70 dark:lg:border-zinc-800 ${U.side && !U.open && !shownDoc ? 'lg:hidden' : ''}`} // T438 #16: no empty bar over nothing
      >
        <button
          data-act="back"
          id="backBtn"
          aria-label="Back"
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:data-pressed:bg-zinc-800"
        >
          <Icon n="left" c="size-6" sw="2" />
        </button>
        {shownDoc ? <div className="hidden shrink-0 lg:flex">{parts.nav}</div> : null}
        <div
          id="dHead"
          className="flex min-w-0 flex-1 flex-col items-center leading-tight lg:flex-row lg:items-center lg:gap-2 lg:pl-2"
        >
          {parts.head}
        </div>
        <div id="dActs" className="hidden items-center gap-0.5 lg:flex">
          {parts.acts}
        </div>
        <button
          data-act="item-menu"
          id="itemMenuBtn"
          hidden={!parts.menu}
          aria-label="Item actions"
          title="All actions · ."
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 lg:size-9 lg:rounded-lg lg:hover:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800 dark:lg:hover:bg-zinc-800"
        >
          <Icon n="more" c="size-6 lg:size-5" />
        </button>
        <div
          id="dNav"
          className={`hidden items-center gap-0.5 border-l border-zinc-200 pl-2 lg:ml-1.5 dark:border-zinc-800 ${shownDoc ? '' : 'lg:flex'}`}
        >
          {shownDoc ? null : parts.nav}
        </div>
      </header>
      <div
        id="detailBody"
        ref={body}
        {...(it && (!U.doc || DUO.on) && !U.docEdit ? { 'data-split': '' } : {})}
        className="-mb-(--foot-h) min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--foot-h,0px)+1.5rem)] lg:scrollbar-gutter-both lg:mask-b-from-[calc(100%-2rem)] lg:group-data-duo/app:pb-0 lg:group-data-[compose]/app:hidden lg:hover:scrollbar-thumb-zinc-500/80 lg:data-split:mask-none dark:lg:hover:scrollbar-thumb-zinc-400/70"
      >
        {parts.body}
      </div>
    </section>
  )
}
