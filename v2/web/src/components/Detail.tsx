// An item as a page of its own (T57): back, code and status on top, the rarely used things behind ⋯. Reading order:
// title, what it needs from you, description, files, documents, subitems, conversation. On the desktop it is the pane
// beside the list (I70), which also shows a document (T110), an input (T274 #9) or the New input page (B73).
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { CHIP, FIELD, LETTER, NEED, NEEDS_CARD, PRIMARY, PRIMARY_BASE, SECOND, TYPE_TEXT } from '../lib/constants'
import {
  CLOSED,
  D,
  U,
  bump,
  byN,
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
  statusName,
  useArea,
  when,
  whoName,
  detailShown,
  type Go,
} from '../lib/state'
import type { Item, Msg } from '../lib/types'
import { hasChoices, inlineMd, clean } from '../lib/markdown'
import { keepGo } from '../lib/go'
import { noteText } from '../lib/docs'
import { kept } from '../lib/drafts'
import { Icon, Kbd, SectionHead, StateIcon } from './ui'
import { DocCard, FileRows, MsgText, Rich, SendAnswerBtn, Talk, Thumbs, docNotes } from './Talk'
import { DocEdit, DocPaneActs, DocPaneHead, DocPaneNav, DocView } from './Doc'
import { InputPane, InputPaneHead } from './Inputs'

// The message the needs card shows: the question, or the agent's report or proposal (then not repeated below).
export const cardMsg = (it: Item): Msg | null =>
  it.wait
    ? it.thread.find((x) => x.id === it.wait?.id) || (it.wait as unknown as Msg)
    : (it.status === 'review' || it.status === 'proposed') && !it.reply
      ? lastAgentMsg(it) || null
      : null // B299
// B299: approving or accepting stays one tap away while the agent has the item back or a question is open
export const KeepBtn = ({ it }: { it: Item }) =>
  it.status === 'proposed' ? (
    <button data-act="status" data-n={it.n} data-v="open" className={SECOND}>
      <Icon n="thumb" c="size-4" />
      Approve
    </button>
  ) : it.status === 'review' ? (
    <button data-act="status" data-n={it.n} data-v="done" className={SECOND}>
      <Icon n="check" c="size-4" sw="2.25" />
      Accept
    </button>
  ) : null
// What waits on you, as a card (T65): the question with its choices, the proposal, the finished work.
export function NeedsCard({ it, onCard = false }: { it: Item; onCard?: boolean }) {
  const n = it.n,
    m = cardMsg(it),
    name = whoName(m?.by || it.wait?.by || (it.by && it.by !== 'you' ? it.by : 'agent'))
  const card = (icon: string, title: string, body: ReactNode, buttons: ReactNode, hint = '') => (
    <section className={NEEDS_CARD}>
      <div className="flex items-center gap-2.5 px-4 pt-3.5 lg:px-5 lg:pt-4">
        <Icon n={icon} c="size-5 text-amber-600 dark:text-amber-400" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-amber-900 lg:text-[15px] dark:text-amber-200">
          {title}
        </p>
        {m?.t ? <span className="text-xs text-amber-700/80 dark:text-amber-300/70">{when(m.t)}</span> : null}
      </div>
      {body ? (
        <div className="space-y-2 px-4 pt-2 text-[15px] leading-relaxed text-zinc-800 lg:px-5 lg:pl-12 dark:text-zinc-200">
          {body}
        </div>
      ) : null}
      {buttons ? (
        <div className="flex gap-2.5 p-3 pt-3.5 lg:items-center lg:justify-end lg:px-5 lg:pb-4">
          {hint ? (
            <p className="mr-auto hidden text-xs text-amber-700/80 xl:block dark:text-amber-300/70">{hint}</p>
          ) : null}
          {buttons}
        </div>
      ) : hint ? (
        <p className="px-4 pt-2 pb-3.5 text-xs text-amber-700/80 lg:px-5 lg:pl-12 dark:text-amber-300/70">{hint}</p>
      ) : (
        <div className="h-3.5" />
      )}
    </section>
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
      `${whoName(w.by)} ${w.kind === 'block' ? 'is blocked and needs you' : 'asks you'}`,
      body,
      keep || choices ? (
        <>
          <KeepBtn it={it} />
          {choices ? <SendAnswerBtn n={n} cls={onCard ? 'flex-1' : 'flex-[1.4] lg:flex-none'} keyHint /> : null}
        </>
      ) : null, // T274 #29, B299
      choices ? 'Pick with 1–9, send with ⌘↵' : '↓ Answer in the box below',
    )
  }
  if (it.reply && (it.status === 'proposed' || it.status === 'review'))
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <Icon n="check" c="size-4" sw="2.25" />
        <span className="mr-auto">You replied. Waiting for your agent.</span>
        <KeepBtn it={it} />
      </div>
    ) // B286, B299
  if (it.status === 'proposed')
    return card(
      'propose',
      `${name} proposed this`,
      m ? (
        <MsgText x={m} gid={'card' + n} whole />
      ) : (
        <p className="text-sm text-amber-900/80 dark:text-amber-200/80">Nobody works on it until you approve.</p>
      ),
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
      m ? 'Nobody works on it until you approve' : '', // T242 #2
    )
  if (it.status === 'review')
    return card(
      'done',
      `${name} finished this`,
      m ? (
        <MsgText x={m} gid={'card' + n} whole />
      ) : (
        <p className="text-sm text-amber-900/80 dark:text-amber-200/80">Check its work, then accept or reopen.</p>
      ),
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
      'Not yet: say what is missing, then it goes back',
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
export const LetterOf = ({ t }: { t: string }) => (
  <span className={`font-mono text-xs font-bold ${TYPE_TEXT[t as 'task']}`}>{LETTER[t as 'task']}</span>
)
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
// F395: a pane wide but short (1100px or more, and 1.4 times as wide as tall) shows the item (or its open document)
// on the left and its talk on the right
export const DUO = { on: false, min: 1100 }
export function ItemPage({ it, left = null }: { it: Item; left?: ReactNode }) {
  const duo = DUO.on
  const talkRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    els.talk = talkRef.current // T322: what scrolls the talk on the desktop
    const top = document.getElementById('itemClip')
    if (top) markOver(top)
  })
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
    shown = cardMsg(it)
  const thread = it.thread.filter((x) => x.id !== it.wait?.id && x.id !== shown?.id),
    hidden = U.more.has(n) ? 0 : Math.max(0, thread.length - 8)
  const caret = <Icon n="down" c="size-3 opacity-50" sw="2.25" />
  // T274 #10: the properties in one row, each one a tap away: status, priority, type, now or later
  const chips = (
    <>
      <button
        data-act="item-menu"
        data-arm="s"
        title="Status · S"
        className={`${CHIP} shrink-0 text-zinc-700 dark:text-zinc-200`}
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
          <LetterOf t={it.type} />
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
      {it.srcs.length ? (
        <button data-act="sources" data-n={n} className={`${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300`}>
          {it.srcs.length === 1 ? 'From 1 input' : `From ${it.srcs.length} inputs`}
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
          className="lg:h-full lg:w-[var(--duo-w,55%)] lg:shrink-0 lg:scrollbar-thin lg:overflow-y-auto lg:px-8 lg:pt-8 lg:pb-12"
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
        className={`lg:min-h-0 lg:flex-1 lg:scrollbar-thin lg:overflow-y-auto lg:data-up:mask-t-from-[calc(100%-2rem)] ${duo ? 'lg:h-full lg:min-w-0' : ''}`}
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
              <Talk it={it} list={thread.slice(hidden)} notes={notes} />
            </div>
          ) : null}
          <NeedsCard it={it} />
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
      {it.wait ? (
        <span className="text-amber-600 dark:text-amber-400">{it.wait.kind === 'block' ? 'Blocked' : 'Asks you'}</span>
      ) : it.reply && !CLOSED(it.status) ? (
        <span className="text-blue-600 dark:text-blue-400">Your agent&apos;s turn</span> // B321: you replied
      ) : (
        <span className={statusTone(it)}>{statusName(it)}</span>
      )}
    </span>
  </>
)
const BarIcon = ({ act, icon, title }: { act: string; icon: string; title: string }) => (
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
  icon: string
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
      {it.type === 'rule' || CLOSED(it.status) || needsYou(it) ? null : (
        <BarText act="status" icon="check" label="Done" title="Done · D" data={{ n: it.n, v: 'done' }} />
      )}
      {it.type === 'rule' || it.archived || CLOSED(it.status) ? null : (
        <BarText
          act="swipe"
          icon="pause"
          label={it.when === 'now' ? 'Later' : 'Back to now'}
          title={it.when === 'now' ? 'Later · L' : 'Back to now · L'}
          data={{ n: it.n, f: 'when', v: it.when === 'now' ? 'later' : 'now' }}
        />
      )}
      {it.archived ? (
        <BarText act="archive" icon="archive" label="Unarchive" title="Unarchive · E" data={{ n: it.n, on: '0' }} />
      ) : (
        <BarText act="archive" icon="archive" label="Archive" title="Archive · E" data={{ n: it.n, on: '1' }} />
      )}
    </>
  )
}
const ItemNav = () => (
  <>
    {U.go ? null : (
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
        {here ? 'Needs you' : 'Going through'}
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
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <p className="text-[15px] text-zinc-500 dark:text-zinc-400">Select an item, or write a new input below</p>
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
        body: <ItemPage it={dIt} left={<DocView d={d} />} />,
      }
    if (d && !U.docEdit)
      return {
        head: <DocPaneHead d={d} editing={false} />,
        acts: <DocPaneActs d={d} />,
        nav: <DocPaneNav d={d} />,
        menu: false,
        body: (
          <div className="w-full px-8 pt-8 pb-12">
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
export function DetailView({ hidden }: { hidden: boolean }) {
  useArea('detail')
  const body = useRef<HTMLDivElement>(null)
  const parts = paneParts()
  const it = U.open ? byN.get(U.open) : undefined
  const g = U.go
  if (g && U.open != null && g.list.includes(U.open)) g.at = U.open
  const strip = !!(g && desk() && !D.compose)
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
      // only when height is short for both parts and width is plenty: wide, and at least 1.4 times as wide as tall
      const on =
        desk() &&
        !!U.open &&
        !D.compose &&
        !D.page &&
        U.tab !== 'inputs' &&
        el.clientWidth >= DUO.min &&
        el.clientWidth >= el.clientHeight * 1.4
      document.getElementById('app')?.toggleAttribute('data-duo', on)
      if (on !== DUO.on) {
        DUO.on = on
        bump('detail')
      }
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
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
    <section
      id="detailView"
      hidden={hidden}
      className={`flex min-h-0 flex-1 flex-col lg:row-span-3 lg:row-start-2 lg:group-data-[compose]/app:row-span-1 ${WIDE_CLS()}`}
    >
      {strip && g ? <GoStrip g={g} /> : null}
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-1 lg:border-zinc-200 lg:px-3 dark:border-zinc-800/70 dark:lg:border-zinc-800">
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
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:scrollbar-gutter-both lg:mask-b-from-[calc(100%-2rem)] lg:group-data-[compose]/app:hidden lg:hover:scrollbar-thumb-zinc-500/80 lg:data-split:mask-none dark:lg:hover:scrollbar-thumb-zinc-400/70"
      >
        {parts.body}
      </div>
    </section>
  )
}
// one wide page: an item at full width (the inputs list takes the left column itself)
export const WIDE_CLS = () => {
  const wide = desk() && D.full && !!U.open && U.tab !== 'inputs' && !D.page
  return wide ? 'lg:col-start-1 lg:col-span-2' : 'lg:col-start-2'
}
