// An item's talk: your words on the right in blue, an agent's on the left in a card under its name, the organizer's
// notes, comments on its documents in time, files and voice notes; what you sent and Taska has not yet, saying where
// it is. The card that waits on you goes where its message is. Props only.

import { useEffect, useState, type ReactNode } from 'react'
import { oneLine } from '../../model/items'
import { voiceMark } from '../../model/inputs'
import { hasChoices, plainQuote } from '../../model/markdown'
import { answerOf, readMark, versions, withdrawn, type Version } from '../../model/talk'
import { when } from '../../model/time'
import type { Comment, Doc, FileRef, Input, Item, Message } from '../../model/types'
import { KIND_WORD, inputCode, plural, whoName } from '../../model/words'
import { Avatar } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import { DC_BTN } from '../../ui/tones'
import { FileRows, VoiceLine, isAudio } from '../../ui/Files'
import { MsgText } from './MsgText'
import { Answered, type CardEvents } from './NeedsCard'
import type { TalkEnv } from './talkEnv'

export interface TalkLineEvents extends CardEvents {
  /** the input a message of yours came from: its menu, its versions, the input itself */
  inputMore(id: string, from: HTMLElement): void
  inputHistory(id: string): void
  goInput(id: string): void
  /** a message's menu; a hidden one shown for a moment, or again for good */
  msgMenu(id: number, from: HTMLElement): void
  peek(id: number): void
  unhide(id: number): void
  /** a place in one of the item's documents */
  docAt(d: number, key: string): void
  /** what you sent and Taska has not yet */
  unsend(q: string): void
  outboxRetry(): void
  outboxEdit(): void
}

export interface Outgoing {
  q: string
  text: string
  state: string
  bad: boolean
  /** you just sent it: Undo takes it back */
  canUndo: boolean
}

export interface TalkFacts {
  /** the inputs your messages came from */
  inputs: ReadonlyMap<string, Input>
  /** hidden messages shown for now */
  peeking: ReadonlySet<number>
  /** the question being answered again */
  reask: number | null
  /** an answer on its way: its words, and where it is */
  going: { text: string; state: string } | null
  /** what you sent to this item and Taska has not yet */
  outgoing: Outgoing[]
  /** a message's Undo (what you just sent), by its input */
  undo(rid: string): string | null
}

const YOU_BUBBLE =
  'max-w-[85%] rounded-2xl rounded-tr-md bg-blue-600 px-4 py-2.5 text-[15px] leading-relaxed text-white dark:bg-blue-500 [&_[data-ref]]:text-white [&_[data-ref]]:underline [&_[data-ref]]:decoration-white/60 [&_[data-ref]]:underline-offset-2 [&_a]:text-white [&_a]:decoration-white/60 [&_blockquote]:border-white/50 [&_blockquote]:text-white/85 [&_button[data-more]]:text-white [&_code]:bg-white/15 [&_code]:text-white [&_mark]:text-zinc-900 [&_pre]:bg-white/15 [&_pre]:text-white'

function KindTag({ x }: { x: Message }) {
  const w = KIND_WORD[x.kind || '']
  if (!w) return null
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${x.kind === 'decide' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}
    >
      {w}
    </span>
  )
}

/** A question that sends you to a document's choices, answered by a reply with nothing picked there. */
const pickInDoc = (x: Message, docs: readonly Doc[]) =>
  x.kind === 'ask' &&
  [...x.text.matchAll(/\bD(\d+)\b/g)].some(([, n]) => {
    const md = docs.find((d) => d.d === Number(n))?.md || ''
    return /^\s*[-*+]\s+[([][ ]?[)\]]\s+/m.test(md) && !/^\s*[-*+]\s+[([][xX][)\]]/m.test(md)
  })

function FromInput({ r, n, code, on }: { r: Input | undefined; n: number; code(n: number | null): string; on: TalkLineEvents }) {
  if (!r) return null
  const there = r.scope && r.scope !== n ? code(r.scope) : ''
  return (
    <span className="-ml-1 text-xs text-zinc-500 dark:text-zinc-400">
      · from{' '}
      <button onClick={() => on.goInput(r.id)} className="font-mono text-blue-600 hover:underline dark:text-blue-400">
        {inputCode(r.id)}
      </button>
      {there ? ` on ${there}` : ''}
    </span>
  )
}

/** Lit for a moment (what you just sent): the colour comes in once the message is drawn, so it fades in and out. */
function useLitIn(lit: boolean): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!lit) return
    const f = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(f)
  }, [lit])
  return lit && on
}

function MsgView({ it, x, env, on, facts, docs, code, done, ver, gone, read }: {
  it: Item
  x: Message
  env: TalkEnv
  on: TalkLineEvents
  facts: TalkFacts
  docs: readonly Doc[]
  code(n: number | null): string
  done: string[] | null
  ver?: Version
  gone: boolean
  read: { names: string[]; t: number } | null
}) {
  const you = x.by === 'you'
  const src = you && x.src ? facts.inputs.get(x.src) : undefined
  const y = ver ? { ...x, text: ver.text } : x
  const lit = useLitIn(!!src && env.lit === src.id)
  const strip = (files: FileRef[] | undefined, size?: string) =>
    files?.length ? (
      <FileRows files={files} url={env.url} size={size} play={env.play} tidy={env.tidy} on={on} cls={you ? 'items-end max-w-full [&>div]:max-w-full' : 'mt-3'} />
    ) : null
  if (you && y.text && y.text.trim().split('\n').every((l) => /^\s*✓/.test(l)) && !src?.files?.length) return null // an answer's ticks show on its card
  if (you) {
    const undo = src ? facts.undo(src.id) : null
    return (
      <div
        ref={src && env.lit === src.id ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
        className={`group flex scroll-mb-4 flex-col items-end gap-1 rounded-2xl transition-colors duration-700 ${lit ? 'bg-blue-50 dark:bg-blue-400/10' : ''} ${ver?.old ? 'opacity-60' : ''}`}
      >
        {y.text ? (
          <div {...voiceMark(src)} className={YOU_BUBBLE}>
            {ver?.old ? (
              <div className="line-clamp-2">
                <MsgText x={y} env={env} on={on} />
              </div>
            ) : (
              <MsgText x={y} env={env} on={on} />
            )}
          </div>
        ) : null}
        {ver?.old ? null : strip(src?.files?.filter((f) => !isAudio(f)))}
        {/* one line under what you wrote: the voice note, who and when, and ⋯ with Edit, Add more and the rest */}
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          {ver?.old ? null : <VoiceLine files={src?.files || []} url={env.url} play={env.play} tidy={env.tidy} bare={!!src && !src.moved} beside on={on} />}
          <span className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            You · {ver?.old ? 'earlier version · ' : ver?.label ? ver.label + ' · ' : ''}
            {when(x.t, env.now)}
            {x.edited && !ver?.old ? (
              <>
                {' · '}
                {src?.history?.length ? (
                  <button
                    onClick={() => on.inputHistory(src.id)}
                    className="relative underline decoration-dotted underline-offset-2 after:absolute after:-inset-3 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    edited {when(x.edited, env.now)}
                  </button>
                ) : (
                  `edited ${when(x.edited, env.now)}`
                )}
              </>
            ) : null}
            {src?.trWait ? (
              <>
                {' · '}
                <span className="animate-pulse text-blue-600 dark:text-blue-400">transcribing…</span>
              </>
            ) : null}
            {read ? (
              <>
                {' · '}
                <span title={`${read.names.join(', ')} read it ${when(new Date(read.t).toISOString(), env.now)}`} className="inline-flex items-center gap-0.5 font-medium text-zinc-500 dark:text-zinc-400">
                  <Icon n="check" c="size-3" sw="2.5" />
                  Read by {read.names.join(', ')}
                </span>
              </>
            ) : null}
          </span>
          {undo && !ver?.old ? (
            <button onClick={() => on.unsend(undo)} className={DC_BTN}>
              Undo
            </button>
          ) : null}
          {src && !ver?.old && !src.moved ? (
            <button aria-label={`More for ${inputCode(src.id)}`} onClick={(e) => on.inputMore(src.id, e.currentTarget)} className={`${DC_BTN} min-w-11 justify-center`}>
              <Icon n="more" c="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    )
  }
  if (x.kind === 'withdraw')
    return (
      <div className="flex items-start gap-2 px-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
        <Icon n="undo" c="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">{whoName(x.by)} took back its question</span> <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{when(x.t, env.now)}</span>
          {x.text.trim() ? <Rich text={x.text} world={env.world} cls="mt-0.5" onRef={on.ref} onPicture={on.picture} /> : null}
        </div>
      </div>
    )
  const head = (tag: ReactNode) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] whitespace-nowrap text-zinc-400 dark:text-zinc-500">
      <Avatar by={x.by} />
      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{whoName(x.by)}</span>
      {x.ses ? <span className="-ml-1 text-xs text-zinc-500 dark:text-zinc-400">· {x.ses}</span> : null}
      {x.to?.length ? <span className="text-xs text-zinc-500 dark:text-zinc-400">→ {x.to.join(', ')}</span> : null}
      {tag}
    </div>
  )
  if (gone)
    return (
      <div className="flex flex-col items-start gap-1.5 opacity-60">
        {head(
          <>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">Withdrawn</span>
            <span>{when(x.t, env.now)}</span>
          </>,
        )}
        <div className="w-full rounded-2xl rounded-tl-md border border-dashed border-zinc-300 px-4 py-3 text-[15px] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <div className="line-clamp-2 line-through decoration-zinc-400 dark:decoration-zinc-500">{oneLine(x.text)}</div>
        </div>
      </div>
    )
  if (x.hidden && !facts.peeking.has(x.id))
    return (
      <button onClick={() => on.peek(x.id)} className="flex items-center gap-1.5 self-start px-1 text-[12px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
        {whoName(x.by)} · hidden message · {when(x.t, env.now)} · Show
      </button>
    )
  // an answered question is its own card, the one it was asked in
  if (done && hasChoices(x.text) && x.kind === 'ask')
    return (
      <Answered
        it={it}
        x={x}
        done={done}
        env={env}
        on={on}
        reasking={facts.reask === x.id}
        going={facts.going && it.thread.filter((m) => m.kind === 'ask').at(-1)?.id === x.id ? facts.going.state : ''}
      />
    )
  return (
    <div className="group/msg flex flex-col items-start gap-1.5">
      {head(
        <>
          {x.by === 'org' && x.src ? <FromInput r={facts.inputs.get(x.src)} n={it.n} code={code} on={on} /> : null}
          {done ? (
            <span className="flex items-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-300">
              <Icon n={pickInDoc(x, docs) ? 'reply' : 'check'} c="size-3" sw="3" />
              {pickInDoc(x, docs) ? 'Skipped' : 'Submitted'}
            </span>
          ) : (
            <KindTag x={x} />
          )}
          {/* the time and the message's More go together, so More is never alone on a line */}
          <span className="flex items-center gap-2">
            {when(x.t, env.now)}
            {x.hidden ? (
              <button onClick={() => on.unhide(x.id)} className={DC_BTN}>
                Show again
              </button>
            ) : (
              <button aria-label="More for this message" onClick={(e) => on.msgMenu(x.id, e.currentTarget)} className={`${DC_BTN} min-w-9 justify-center lg:opacity-0 lg:group-hover/msg:opacity-100 lg:focus-visible:opacity-100`}>
                <Icon n="more" c="size-3.5" />
              </button>
            )}
          </span>
        </>,
      )}
      <div className="w-full rounded-2xl rounded-tl-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <MsgText x={x} env={env} on={on} done={done} />
        {strip(x.files, 'h-48 w-24')}
      </div>
    </div>
  )
}

export interface Note {
  t: string
  node: ReactNode
}

/** The comments on the item's documents, as messages, in time (from `from` on). */
export function docNotes(docs: readonly Doc[], env: TalkEnv, on: TalkLineEvents, from = ''): Note[] {
  const all = docs
    .flatMap((d) => [
      ...d.blocks.flatMap((b) => b.comments.map((c) => ({ c, d, key: b.key, changed: false }))),
      ...(d.whole || []).map((c) => ({ c, d, key: 'doc', changed: false })),
      ...d.detached.flatMap((t) => t.comments.map((c) => ({ c, d, key: t.key, changed: true }))),
    ])
    .filter(({ c }) => c.t && (!from || c.t >= from))
    .sort((a, b) => a.c.t.localeCompare(b.c.t))
  return all.map(({ c, d, key, changed }: { c: Comment; d: Doc; key: string; changed: boolean }) => {
    const you = c.by === 'you'
    // the words it is about were changed in the document since: the quote struck through, and said
    const gone = changed ? <span className="shrink-0">· Original text changed</span> : null
    const where = (
      <button onClick={() => on.docAt(d.d, key)} className="-mx-1 rounded px-1 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
        on <span className="font-mono">D{d.d}</span>
      </button>
    )
    const quote = c.quote ? (
      <button
        onClick={() => on.docAt(d.d, key)}
        className={`mb-1.5 line-clamp-3 block w-full border-l-2 pl-2 text-left text-[13px] leading-snug ${changed ? 'line-through' : ''} ${you ? 'border-white/50 text-white/85' : 'border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400'}`}
      >
        “{plainQuote(c.quote)}”
      </button>
    ) : null
    const words = c.text.trim() ? (
      <Rich text={c.text} world={env.world} onRef={on.ref} onPicture={on.picture} />
    ) : c.files?.some(isAudio) ? (
      'Voice note'
    ) : (
      plural(c.files?.length || 0, 'file')
    )
    return {
      t: c.t,
      node: you ? (
        <div key={`dn${d.d}-${c.id}`} className="flex flex-col items-end gap-1">
          <div className={YOU_BUBBLE}>
            {quote}
            {words}
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-x-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <VoiceLine files={c.files || []} url={env.url} play={env.play} tidy={env.tidy} bare on={on} />
            <span className="flex max-w-full min-w-0 items-center gap-0.5 px-1">
              <Icon n="comment" c="size-3 shrink-0" />
              <span className="min-w-0 truncate">
                You · {where} · {c.id > 0 ? when(c.t, env.now) : 'Sending…'} {gone}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <div key={`dn${d.d}-${c.id}`} className="flex flex-col items-start gap-1.5">
          <div className="flex max-w-full min-w-0 items-center gap-2 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <Avatar by={c.by} />
            <span className="shrink-0 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{whoName(c.by)}</span>
            <Icon n="comment" c="size-3 shrink-0" />
            {where}
            <span className="shrink-0">{when(c.t, env.now)}</span>
            {gone}
          </div>
          <div className="w-full rounded-2xl rounded-tl-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {quote}
            {words}
          </div>
        </div>
      ),
    }
  })
}

/** What you sent to this item, in the talk at once, saying where it is, until Taska has it. */
function Pending({ list, on }: { list: Outgoing[]; on: TalkLineEvents }) {
  return (
    <>
      {list.map((q) => (
        <div key={q.q} className="flex flex-col items-end gap-1">
          <div className={`${YOU_BUBBLE} break-words whitespace-pre-wrap ${q.bad ? 'opacity-70' : ''}`}>{q.text}</div>
          <div className="flex flex-wrap items-center justify-end gap-x-1">
            <span className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              You · <span className={q.bad ? 'text-red-600 dark:text-red-400' : 'animate-pulse text-blue-600 dark:text-blue-400'}>{q.state}</span>
            </span>
            {q.bad ? (
              <>
                <button onClick={on.outboxRetry} className={DC_BTN}>
                  Retry
                </button>
                <button onClick={on.outboxEdit} className={DC_BTN}>
                  Edit
                </button>
              </>
            ) : q.canUndo ? (
              <button onClick={() => on.unsend(q.q)} className={DC_BTN}>
                Undo
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </>
  )
}

/** The talk's messages (from the first one shown), the documents' comments among them, the card where its message is. */
export function Talk({ it, list, notes, card, env, on, facts, docs, code }: {
  it: Item
  list: readonly Message[]
  notes: Note[]
  card?: { id: number; node: ReactNode }
  env: TalkEnv
  on: TalkLineEvents
  facts: TalkFacts
  docs: readonly Doc[]
  code(n: number | null): string
}) {
  const th = it.thread
  const vers = versions(th)
  const gone = withdrawn(th)
  const read = readMark(it)
  const out: ReactNode[] = []
  let k = 0
  const before = (t: string) => {
    while (k < notes.length && (!t || notes[k].t < t)) out.push(notes[k++].node)
  }
  for (const x of list) {
    before(x.t)
    if (card && x.id === card.id) {
      out.push(<div key={'card' + x.id}>{card.node}</div>)
      continue
    }
    out.push(
      <MsgView
        key={x.id}
        it={it}
        x={x}
        env={env}
        on={on}
        facts={facts}
        docs={docs}
        code={code}
        done={gone.has(x.id) ? null : answerOf(th, x, facts.going?.text ?? null)}
        ver={vers.get(x.id)}
        gone={gone.has(x.id)}
        read={read?.id === x.id ? { names: read.names.map(whoName), t: read.t } : null}
      />,
    )
  }
  before('')
  out.push(<Pending key="pending" list={facts.outgoing} on={on} />)
  return <>{out}</>
}

