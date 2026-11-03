// B629: one input as the list draws it, words first: a line with its number and when, its words, its pictures and
// voice note, and what became of it in one short line (the phone: under the words; the desktop: beside them, in a
// narrow column, so a short input takes two lines of height). No boxes, no bubbles. Its buttons: the phone's ⋯ (Add
// more is in it with Edit, Undo organizing, Move, History, Delete); the desktop's Add more and ⋯, at the end of its
// first line under the pointer only, taking no room.
import type { ReactNode } from 'react'
import { isAudio, isImage, Thumbs } from '../../ui/Files'
import { Icon, StateIcon } from '../../ui/Icon'
import { HIT, TYPE_TEXT } from '../../ui/tones'
import { PICTURES, WORD, type Entry, type ItemRef, type Outcome } from './inputsDemo'

const noop = () => {}
const LINK = `${HIT} shrink-0 font-semibold text-blue-600 hover:underline dark:text-blue-400`
const MUTED = 'text-zinc-500 dark:text-zinc-400'

/** Its pictures, then its voice note, as the page draws them (a thumbnail; the voice chip with its length). */
function Files({ e, desk }: { e: Entry; desk: boolean }) {
  const files = [...e.r.files.filter(isImage), ...e.r.files.filter(isAudio)]
  if (!files.length) return null
  return (
    <div className={`flex flex-wrap items-end gap-2 ${e.r.text ? 'mt-1.5' : 'mt-1'}`}>
      <Thumbs files={files} url={(f) => PICTURES[f] ?? '#' + f} size={desk ? 'size-16' : 'size-14'} play={() => ({ playing: false, t: null })} tidy={false} on={{ play: noop, words: noop, view: noop }} />
    </div>
  )
}

/** Its words. A long one shows four lines, its paragraphs closed up and its last line fading (no ellipsis: after a
 * full stop it reads "..."), with More; opened, all of it, with Less. */
function Words({ e, opened, toggle }: { e: Entry; opened: boolean; toggle(): void }) {
  if (!e.r.text) return null
  const cut = e.long && !opened
  return (
    <div className="mt-0.5 text-[15px] leading-6 text-zinc-900 dark:text-zinc-100">
      {cut ? (
        <p className="max-h-24 overflow-hidden break-words whitespace-pre-line [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">{e.r.text.replace(/\n{2,}/g, '\n')}</p>
      ) : (
        // paragraphs a third of a line apart, not a whole empty line
        e.r.text.split(/\n{2,}/).map((para, i) => (
          <p key={i} className={`break-words whitespace-pre-line ${i ? 'mt-2' : ''}`}>
            {para}
          </p>
        ))
      )}
      {e.long ? (
        <button onClick={toggle} className={`${LINK} text-[13px] leading-6`}>
          {opened ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  )
}

/** An item: its status mark, code and title; the title wraps, it is never cut. */
function ItemLink({ it }: { it: ItemRef }) {
  return (
    <button className={`${HIT} flex min-w-0 items-start gap-1.5 text-left hover:underline`}>
      <StateIcon {...it.status} cls="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className={`mr-1 font-mono text-xs font-bold ${TYPE_TEXT[it.type]}`}>{it.code}</span>
        <span className="text-zinc-800 dark:text-zinc-200">{it.title}</span>
      </span>
    </button>
  )
}

/** What became of it, in a line or two of 13px, the same words everywhere: the items with what was done to them, or
 * where it stands with what can be done now (Try again, Organize again, the way to the project it moved to). Every
 * line starts with words at the same left edge (no icon before a state: its colour says it, blue while Taska is on it,
 * red when it failed, green when done). */
function Became({ o }: { o: Outcome }) {
  if (o.k === 'filed' || o.k === 'answer') {
    const rows: { did: string; item: ItemRef }[] = o.k === 'filed' ? o.items : [{ did: WORD.answer, item: o.item }]
    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] content-start items-start gap-x-1.5 text-[13px] leading-5">
        {rows.map(({ did, item: it }, i) => (
          <div key={it.n} className="contents">
            {/* what was done, said once over the items it was done to */}
            <span className={`whitespace-nowrap ${MUTED}`}>{i && rows[i - 1].did === did ? '' : did}</span>
            <ItemLink it={it} />
          </div>
        ))}
      </div>
    )
  }
  const line = (text: ReactNode, tone: string, after?: ReactNode) => (
    <div className="flex flex-wrap items-start gap-x-2 text-[13px] leading-5">
      <span className={`min-w-0 font-medium ${tone}`}>{text}</span>
      {after}
    </div>
  )
  const busy = 'text-blue-600 dark:text-blue-400'
  const quiet = 'text-zinc-600 dark:text-zinc-300'
  switch (o.k) {
    case 'transcribing':
    case 'organizing':
      return line(WORD[o.k], busy)
    case 'failed':
      return line(
        WORD.failed,
        'text-red-600 dark:text-red-400',
        <>
          <span className={MUTED}>{o.why}</span>
          <button className={LINK}>{WORD.tryAgain}</button>
        </>,
      )
    case 'undone':
      return line(WORD.undone, quiet, <button className={LINK}>{WORD.organizeAgain}</button>)
    case 'agent':
      return line(WORD.agent, quiet)
    case 'handled':
      return line(WORD.handled, 'text-emerald-700 dark:text-emerald-400')
    default:
      // where it went, then the way there, blue as every other thing to do here
      return line(
        WORD.moved(o),
        quiet,
        <a href="#" onClick={(ev) => ev.preventDefault()} className={LINK}>
          Open {o.as} there
        </a>,
      )
  }
}

const BTN = 'flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
/** Its buttons at the end of its first line (none for one moved away: it lives in the other project now). */
function Acts({ e, desk, pointed }: { e: Entry; desk: boolean; pointed: boolean }) {
  if (e.out.k === 'moved') return null
  const more = (
    <button className={`${BTN} w-7 justify-center px-0`} aria-label={`More for ${e.code}`} title="More">
      <Icon n="more" c="size-4" />
    </button>
  )
  if (!desk) return <span className="-my-1.5 -mr-1.5 ml-auto flex">{more}</span>
  return (
    <span className={`-my-1.5 -mr-1.5 ml-auto flex items-center ${pointed ? '' : 'invisible group-focus-within/row:visible group-hover/row:visible'}`}>
      <button className={BTN}>
        <Icon n="plus" c="size-3.5" sw="2" />
        Add more
      </button>
      {more}
    </span>
  )
}

export function InputItem({ e, desk, opened, toggle, pointed = false }: { e: Entry; desk: boolean; opened: boolean; toggle(): void; pointed?: boolean }) {
  const said = (
    <div className="min-w-0">
      <div className="flex h-5 items-center gap-2 text-[13px]">
        <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{e.code}</span>
        <span className={`tabular-nums ${MUTED}`}>{e.when}</span>
        <Acts e={e} desk={desk} pointed={pointed} />
      </div>
      <Words e={e} opened={opened} toggle={toggle} />
      <Files e={e} desk={desk} />
    </div>
  )
  if (desk)
    return (
      <article
        className={`group/row -mx-3 grid grid-cols-[minmax(0,1fr)_17rem] items-start gap-x-6 border-t border-zinc-100 px-3 py-2.5 first:border-t-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-900 ${pointed ? 'bg-zinc-50 dark:bg-zinc-900' : ''}`}
      >
        {said}
        <Became o={e.out} />
      </article>
    )
  return (
    <article className="border-t border-zinc-100 px-4 py-2.5 first:border-t-0 dark:border-zinc-800/70">
      {said}
      <div className="mt-1.5">
        <Became o={e.out} />
      </div>
    </article>
  )
}

/** The list: newest first. The desktop names it (under the New input box); the phone's tab bar already does. */
export function InputsList({ list, desk, opened, toggle, pointed = null }: { list: Entry[]; desk: boolean; opened: ReadonlySet<string>; toggle(id: string): void; pointed?: string | null }) {
  return (
    <div className="flex flex-col">
      {desk ? (
        <h2 className="pb-1 text-[15px] font-semibold">
          Inputs <span className="font-normal text-zinc-400 tabular-nums">{list.length}</span>
        </h2>
      ) : null}
      {list.length ? (
        list.map((e) => <InputItem key={e.r.id} e={e} desk={desk} opened={opened.has(e.r.id)} toggle={() => toggle(e.r.id)} pointed={pointed === e.r.id} />)
      ) : (
        <div className={`py-16 text-center text-sm ${MUTED}`}>No inputs yet</div>
      )}
    </div>
  )
}
