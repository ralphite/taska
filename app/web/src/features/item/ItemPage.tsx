// An item as a page of its own: its title and its fields (each a tap away), what it needs from you, its text, its
// documents, files and subitems, then its talk. On the desktop the item and its talk are two parts, each scrolling
// on its own, with a line between them; the talk opens at its latest message. The phone has one page. Props only.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { canDone, closed, shownStatus } from '../../model/items'
import { talkPlan } from '../../model/talk'
import type { Doc, FileRef, Item } from '../../model/types'
import { Kbd, SectionHead, Soft } from '../../ui/bits'
import { Grip } from '../../ui/Grip'
import { Icon, StateIcon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import { Rich } from '../../ui/Markdown'
import { clean, inlineHtml } from '../../ui/markdown/inline'
import { ACT_ICON, CHIP, FIELD, NEED, PRIMARY, SECOND, TYPE_TEXT } from '../../ui/tones'
import { FileRows } from '../inputs/Files'
import { DocCard } from './DocCard'
import { NeedsCard } from './NeedsCard'
import { Talk, docNotes, type TalkFacts, type TalkLineEvents } from './Talk'
import type { TalkEnv } from './talkEnv'

export interface ItemEvents extends TalkLineEvents {
  /** the item's menu, or one of its fields' (status, priority, type) */
  menu(arm: 's' | 'p' | 't' | null, from: Element): void
  set(f: 'when' | 'archived' | 'status', v: string | boolean): void
  sources(): void
  /** the item's part over its talk dragged to this height (`done`: let go, kept) */
  topSize(px: number, done: boolean): void
  /** in two columns, the left one dragged to this width (0: back to the page's own) */
  duoSize(px: number, done: boolean): void
  goto(n: number): void
  doc(d: number): void
  earlier(): void
  subNew(): void
  subAdd(title: string): void
  subCancel(): void
  editSave(f: { title: string; body: string; next: string }): void
  editCancel(): void
}

export interface ItemFacts {
  code(n: number | null | undefined): string
  parent: Item | undefined
  kids: Item[]
  /** the files of what it was made from */
  files: FileRef[]
  /** how many inputs it was made from (answers to its questions not counted) */
  sources: number
  docs: Doc[]
  /** your decision on it is open to choose again */
  remodify: boolean
  /** the whole talk shows (Show earlier) */
  allTalk: boolean
  editing: boolean
  addingSub: boolean
}

const caret = <Icon n="down" c="size-3 opacity-50" sw="2.25" />

function Chips({ it, f, on }: { it: Item; f: ItemFacts; on: ItemEvents }) {
  const shown = shownStatus(it)
  return (
    <>
      <button
        title="Status · S"
        onClick={(e) => on.menu('s', e.currentTarget)}
        className={`${CHIP} min-w-32 shrink-0 ${shown.s === 'wait' ? `font-semibold ${NEED.answer.text}` : 'text-zinc-700 dark:text-zinc-200'}`}
      >
        <StateIcon {...shown} cls="size-3.5" />
        {shown.label}
        {caret}
      </button>
      {it.type === 'rule' ? null : (
        <button
          title="Priority · P"
          onClick={(e) => on.menu('p', e.currentTarget)}
          className={`${CHIP} shrink-0 ${it.pri === 'P0' ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-zinc-700 dark:text-zinc-200'}`}
        >
          {it.pri}
          {caret}
        </button>
      )}
      {it.type === 'rule' ? null : (
        <button title="Type · T" onClick={(e) => on.menu('t', e.currentTarget)} className={`${CHIP} shrink-0 text-zinc-700 dark:text-zinc-200`}>
          {it.type[0].toUpperCase() + it.type.slice(1)}
          {caret}
        </button>
      )}
      {closed(it.status) || it.type === 'rule' ? null : (
        <button
          title={`${it.when === 'later' ? 'Back to now' : 'Later'} · L`}
          onClick={() => on.set('when', it.when === 'later' ? 'now' : 'later')}
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
      {f.sources ? (
        <button onClick={on.sources} className={`${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300`}>
          {f.sources === 1 ? 'From 1 input' : `From ${f.sources} inputs`}
        </button>
      ) : null}
      {f.parent ? (
        <button onClick={() => on.goto((f.parent as Item).n)} className={`${CHIP} min-w-0 flex-1 basis-32 text-zinc-700 dark:text-zinc-300`}>
          <Icon n="link" c="size-3.5 opacity-60" />
          <span className="truncate">
            <span className="mr-1 text-zinc-500 dark:text-zinc-400">Part of</span>
            <span className={`mr-1 font-mono font-bold ${TYPE_TEXT[f.parent.type]}`}>{f.code(f.parent.n)}</span>
            {f.parent.title}
          </span>
        </button>
      ) : null}
    </>
  )
}

function Editor({ it, on }: { it: Item; on: ItemEvents }) {
  const [title, setTitle] = useState(it.title)
  const [body, setBody] = useState(it.body)
  const [next, setNext] = useState(it.next)
  return (
    <div className="flex flex-col gap-2">
      <input className={`${FIELD} font-medium`} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <textarea rows={8} className={`${FIELD} leading-relaxed`} aria-label="Details" placeholder="Details" value={body} onChange={(e) => setBody(e.target.value)} />
      <input className={FIELD} value={next} onChange={(e) => setNext(e.target.value)} aria-label="Next step" placeholder="Next step (optional)" />
      <div className="flex justify-end gap-2">
        <button onClick={on.editCancel} className={SECOND}>
          Cancel
        </button>
        <button onClick={() => on.editSave({ title, body, next })} className={PRIMARY}>
          Save
        </button>
      </div>
    </div>
  )
}

function Subitems({ it, f, on }: { it: Item; f: ItemFacts; on: ItemEvents }) {
  const [title, setTitle] = useState('')
  const kids = f.kids
  return (
    <section className="flex flex-col gap-2">
      <SectionHead
        text={`Subitems${kids.length ? ` · ${kids.filter((k) => closed(k.status)).length}/${kids.length}` : ''}`}
        right={
          f.addingSub ? null : (
            <button onClick={on.subNew} className="-my-2.5 flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">
              <Icon n="plus" c="size-4" sw="2" />
              Add
            </button>
          )
        }
      />
      {kids.length ? (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {kids.map((k) => (
            <button
              key={k.n}
              onClick={() => on.goto(k.n)}
              className={`flex w-full items-start gap-3 px-3 py-3 text-left first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-50 data-pressed:bg-zinc-100 dark:hover:bg-zinc-900 dark:data-pressed:bg-zinc-800 ${closed(k.status) ? 'opacity-55' : ''}`}
            >
              <StateIcon {...shownStatus(k)} />
              <span className={`min-w-0 flex-1 text-[15px] leading-snug ${closed(k.status) ? 'line-through' : ''}`}>
                <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[k.type]}`}>{f.code(k.n)}</span>
                {k.title}
              </span>
              {k.when === 'later' && !closed(k.status) ? (
                <span className="mt-0.5 flex shrink-0 text-xs font-medium">
                  <Soft>Later</Soft>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {f.addingSub ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) on.subAdd(title.trim())
              if (e.key === 'Escape') on.subCancel()
            }}
            className={`${FIELD} min-w-0 flex-1`}
            placeholder={`Subitem of ${f.code(it.n)}`}
            aria-label="Subitem title"
          />
          <button onClick={() => title.trim() && on.subAdd(title.trim())} className={PRIMARY}>
            Add
          </button>
          <button aria-label="Cancel" onClick={on.subCancel} className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Icon n="x" c="size-5" />
          </button>
        </div>
      ) : null}
    </section>
  )
}

/** The talk fades at its bottom while more of it is below, and at its top while some of it is above. */
const overflows = (el: HTMLElement) => el.scrollTop + el.clientHeight < el.scrollHeight - 2
const marks = (el: HTMLElement) => {
  el.toggleAttribute('data-more', overflows(el))
  el.toggleAttribute('data-up', el.scrollTop > 2)
}

export function ItemPage({ it, f, env, facts, on, talkRef, duo = false, left = null, bare = false }: {
  it: Item
  f: ItemFacts
  env: TalkEnv
  facts: TalkFacts
  on: ItemEvents
  /** the talk's element, for the keys (Space scrolls it) */
  talkRef?: (el: HTMLElement | null) => void
  /** the desktop's two columns: the item (or `left`, its document) on the left, its talk on the right */
  duo?: boolean
  left?: ReactNode
  /** `left` brings its own margins (a web page) */
  bare?: boolean
}) {
  const clip = useRef<HTMLDivElement>(null)
  const talk = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    // the item's part taller than its share fades while more of it is below
    const el = clip.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const mark = () => el.toggleAttribute('data-over', overflows(el))
    const ro = new ResizeObserver(mark)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    mark()
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    // the talk at its latest message stays there when the part above grows or shrinks (and opens there)
    const el = talk.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let atEnd = true
    const seen = () => (atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4)
    const ro = new ResizeObserver(() => {
      if (atEnd) el.scrollTop = el.scrollHeight
      marks(el)
    })
    el.addEventListener('scroll', seen, { passive: true })
    ro.observe(el)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', seen)
    }
  }, [])
  const asks = !!it.wait || ((it.status === 'proposed' || it.status === 'review') && !it.talked)
  const asked = useRef({ n: it.n, on: asks })
  useLayoutEffect(() => {
    // the card that asks you comes back (an Undo, a change put back): the talk shows it, at its end
    const el = talk.current
    if (asks && asked.current.n === it.n && !asked.current.on && el) el.scrollTop = el.scrollHeight
    asked.current = { n: it.n, on: asks }
  }, [asks, it.n])

  const head = f.editing ? (
    <Editor key={it.n} it={it} on={on} />
  ) : (
    <div className="flex flex-col gap-3">
      <h1 className={`text-[22px] leading-[1.35] font-semibold break-words ${it.status === 'dropped' ? 'line-through' : ''}`}>{it.title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Chips it={it} f={f} on={on} />
      </div>
    </div>
  )
  const desc =
    !f.editing && (it.body || it.next) ? (
      <div className="flex flex-col gap-3">
        {it.body ? <Rich text={it.body} world={env.world} cls="text-base text-zinc-800 dark:text-zinc-200" onRef={on.ref} onPicture={on.picture} /> : null}
        {it.next ? (
          <div className="flex gap-2 text-sm">
            <span className="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Next</span>
            <span className="min-w-0 break-words text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: clean(inlineHtml(it.next, env.world)) }} />
          </div>
        ) : null}
      </div>
    ) : null

  const plan = talkPlan(it, { all: f.allTalk, going: facts.going?.text ?? null })
  const notes = docNotes(f.docs, env, on, plan.hidden ? plan.thread[plan.hidden]?.t : '')
  const top = plan.first && (plan.thread.length > 0 || notes.length > 0)
  const card = <NeedsCard it={it} env={env} on={on} remodify={f.remodify} going={facts.going?.text ?? null} />
  return (
    <div className={`group/item flex flex-col gap-6 px-5 pt-5 pb-10 lg:h-full lg:gap-0 lg:p-0 ${duo ? 'lg:flex-row' : ''}`}>
      {duo && left ? (
        <div data-item-top className={`lg:h-full lg:w-[var(--duo-w,55%)] lg:shrink-0 lg:scrollbar-thin lg:overflow-y-auto ${bare ? '' : 'lg:px-8 lg:pt-8 lg:pb-12'}`}>
          {left}
        </div>
      ) : (
      <div data-item-top className={`flex flex-col lg:shrink-0 ${duo ? 'lg:h-full lg:w-[var(--duo-w,55%)]' : f.editing ? 'lg:max-h-full' : 'lg:h-[var(--top-h,40%)]'}`}>
        <div ref={clip} data-item-clip onScroll={(e) => e.currentTarget.toggleAttribute('data-over', overflows(e.currentTarget))} className="lg:min-h-0 lg:scrollbar-thin lg:overflow-y-auto lg:data-over:mask-b-from-[calc(100%-4rem)]">
          <div className="flex flex-col gap-6 lg:mx-auto lg:w-full lg:max-w-[46rem] lg:px-8 lg:pt-7 lg:pb-6">
            {head}
            {desc}
            {f.docs.length ? (
              <section className="flex flex-col gap-2">
                <SectionHead text="Documents" />
                {f.docs.map((d) => (
                  <DocCard key={d.d} d={d} now={env.now} onOpen={on.doc} />
                ))}
              </section>
            ) : null}
            {f.files.length ? <FileRows files={f.files} url={env.url} size="h-24 w-16" play={env.play} tidy={env.tidy} on={on} /> : null}
            {f.kids.length || f.addingSub ? <Subitems it={it} f={f} on={on} /> : null}
          </div>
        </div>
      </div>
      )}
      {duo ? (
        // the line between the two columns, dragged sideways like the other lines
        <Grip
          axis="x"
          place="relative z-10 hidden w-px shrink-0 bg-zinc-200 after:absolute after:-inset-x-1.5 after:inset-y-0 lg:block dark:bg-zinc-800"
          measure={(el) => {
            const from = el.previousElementSibling?.getBoundingClientRect().left ?? 0
            return { from, most: innerWidth - from }
          }}
          onSize={(px) => on.duoSize(px, false)}
          onDone={(px) => on.duoSize(px, true)}
          onReset={() => on.duoSize(0, true)}
        />
      ) : (
      /* the line between the item and its talk, dragged up and down anywhere you like (a double-click leaves it) */
      <Grip
        axis="y"
        place="relative z-10 hidden h-px shrink-0 bg-zinc-200 after:absolute after:inset-x-0 after:-inset-y-2 lg:block dark:bg-zinc-800"
        measure={(el) => ({ from: el.previousElementSibling?.getBoundingClientRect().top ?? 0, most: el.parentElement?.clientHeight ?? innerHeight })}
        onSize={(px) => on.topSize(px, false)}
        onDone={(px) => on.topSize(px, true)}
      />
      )}
      <div
        data-item-talk
        ref={(el) => {
          talk.current = el
          talkRef?.(el)
        }}
        onScroll={(e) => marks(e.currentTarget)}
        // in two columns they run to the bottom of the screen and the talk ends clear above the box; in one the talk
        // runs on under the box, its own padding keeping its end where it was
        className={`lg:min-h-0 lg:flex-1 lg:scrollbar-thin lg:overflow-y-auto lg:data-up:mask-t-from-[calc(100%-2rem)] ${duo ? 'lg:h-full lg:min-w-0 lg:pb-[calc(var(--foot-h,0px)+1.5rem)]' : 'lg:-mb-(--foot-h) lg:pb-(--foot-h) dark:lg:-mb-[calc(var(--foot-h,0px)+1.5rem)] dark:lg:pb-[calc(var(--foot-h,0px)+1.5rem)]'}`}
      >
        <div className="flex flex-col gap-6 lg:mx-auto lg:w-full lg:max-w-[46rem] lg:px-8 lg:py-6">
          {plan.thread.length || notes.length ? (
            <div className="flex flex-col gap-6 border-t border-zinc-100 pt-6 lg:border-0 lg:pt-0 dark:border-zinc-800/70">
              {plan.hidden ? (
                <button onClick={on.earlier} className="-my-1 h-11 self-center rounded-lg px-3 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">
                  Show {plan.hidden} earlier
                </button>
              ) : null}
              {top ? card : null}
              <Talk
                it={it}
                list={plan.thread.slice(plan.hidden)}
                notes={notes}
                card={plan.inline && plan.cardId != null ? { id: plan.cardId, node: card } : undefined}
                env={env}
                on={on}
                facts={facts}
                docs={f.docs}
                code={f.code}
              />
            </div>
          ) : null}
          {plan.inline || top ? null : card}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the pane's bar for an item

/** The bar's head: the item's status icon (desktop), its code, and "Your agent's turn" when you replied. */
export function ItemHead({ it, code }: { it: Item; code: string }) {
  return (
    <>
      <span className="hidden lg:inline">
        <StateIcon {...shownStatus(it)} cls="size-[18px]" />
      </span>
      <span className={`font-mono text-sm font-bold ${TYPE_TEXT[it.type]}`}>{code}</span>
      <span className="text-[11px] font-semibold tracking-wider uppercase">
        {!it.wait && it.talked && !closed(it.status) ? <span className="text-blue-600 dark:text-blue-400">Your agent&apos;s turn</span> : null}
      </span>
    </>
  )
}

function BarText({ icon, label, title, onClick }: { icon: IconName; label: string; title: string; onClick(): void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <Icon n={icon} c="size-4" />
      {label}
    </button>
  )
}

function BarIcon({ icon, title, onClick }: { icon: IconName; title: string; onClick(): void }) {
  return (
    <button
      title={title}
      aria-label={title.split(' · ')[0]}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <Icon n={icon} c="size-[18px]" />
    </button>
  )
}

/** The actions you use, with their words: only what applies, side by side. */
export function ItemActs({ it, on }: { it: Item; on: Pick<ItemEvents, 'set'> }) {
  return (
    <>
      {it.type === 'rule' || !canDone(it) ? null : <BarText icon={ACT_ICON.Done} label="Done" title="Done · D" onClick={() => on.set('status', 'done')} />}
      {it.type === 'rule' || it.archived || closed(it.status) ? null : (
        <BarText
          icon="clock"
          label={it.when === 'now' ? 'Later' : 'Back to now'}
          title={it.when === 'now' ? 'Later · L' : 'Back to now · L'}
          onClick={() => on.set('when', it.when === 'now' ? 'later' : 'now')}
        />
      )}
      {it.archived ? (
        <BarText icon="unarchive" label="Unarchive" title="Unarchive · E" onClick={() => on.set('archived', false)} />
      ) : (
        <BarText icon="archive" label="Archive" title="Archive · E" onClick={() => on.set('archived', true)} />
      )}
    </>
  )
}

/** Previous, next, and the full width (or back to the list). */
export function ItemNav({ full, on }: { full: boolean; on: { prev(): void; next(): void; full(): void } }) {
  return (
    <>
      <BarIcon icon="chevup" title="Previous · K" onClick={on.prev} />
      <BarIcon icon="down" title="Next · J" onClick={on.next} />
      <BarIcon icon={full ? 'shrink' : 'open'} title={full ? 'Back to the list · Esc' : 'Full width · O'} onClick={on.full} />
    </>
  )
}

/** The pane when the item the address names is not here: its data still coming (or Taska out of reach), or not in
 * this project. */
export function Missing({ what, loading, away }: { what: string; loading: boolean; away: boolean }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <p className="text-[15px] text-zinc-500 dark:text-zinc-400">{!loading ? `${what} is not in this project` : away ? 'Taska is out of reach, retrying…' : `Loading ${what}…`}</p>
    </div>
  )
}

/** The pane with nothing open: what to do. */
export function NoSelection({ side }: { side: 'docs' | 'log' | null }): ReactNode {
  if (side)
    return <div className="grid h-full place-items-center p-8 text-center text-[15px] text-zinc-500 dark:text-zinc-400">{side === 'docs' ? 'Pick a document to read it here' : 'Select a line to view'}</div>
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <p className="text-[15px] text-zinc-500 dark:text-zinc-400">Select an item or type below</p>
        <p className="mt-2 flex items-center justify-center gap-1 text-[13px] text-zinc-400">
          <Kbd k="J" />
          <Kbd k="K" />
          <span className="ml-1">to move</span>
        </p>
      </div>
    </div>
  )
}

