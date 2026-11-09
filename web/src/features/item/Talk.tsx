// An item's talk: your words on the right in blue, an agent's on the left in a card under its name, the organizer's
// notes, comments on its documents in time, files and voice notes; what you sent and Taska has not yet, saying where
// it is. The card that waits on you goes where its message is. Props only.

import { Fragment, type ReactNode } from 'react'
import { oneLine } from '../../model/items'
import { voiceMark } from '../../model/inputs'
import { hasChoices } from '../../model/markdown'
import type { Became, ItemRef } from '../../model/became'
import { MADE_WORD, becameText, showsIn } from '../../model/inputStates'
import { answerOf, readMark, versions, withdrawn, type DocNote, type Version } from '../../model/talk'
import { when } from '../../model/time'
import type { Doc, FileRef, Input, Item, Message } from '../../model/types'
import { KIND_WORD, inputCode, whoName } from '../../model/words'
import { Avatar } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import { DC_BTN, DC_LINK, MUTED, YOU_BUBBLE } from '../../ui/tones'
import { FileRows, VoiceBubble, isAudio } from '../../ui/Files'
import { OUT_ACT_WORD, type OutShow, type OutTone } from '../../model/outgoingStates'
import { MsgText } from './MsgText'
import { DocComment } from './TalkDocComment'
import { Answered, type CardEvents } from './NeedsCard'
import type { TalkEnv } from './talkEnv'

export interface TalkLineEvents extends CardEvents {
  /** the input a message of yours came from: its menu, its versions, the input itself */
  inputMore(id: string, from: HTMLElement): void
  inputHistory(id: string): void
  goInput(id: string): void
  /** the project a message's input was moved to */
  moved(href: string): void
  /** a message's menu; a hidden one shown for a moment, or again for good */
  msgMenu(id: number, from: HTMLElement): void
  peek(id: number): void
  unhide(id: number): void
  /** a place in one of the item's documents */
  docAt(d: number, key: string): void
  /** what you sent and Taska has not yet, cancelled (its ×, B666): it does not go */
  cancel(q: string): void
  /** one Taska said no to, sent again */
  outboxRetry(q: string): void
  /** one not sent yet, back in the box to change */
  outboxEdit(q: string): void
}

export interface Outgoing {
  q: string
  text: string
  /** where it is and what can be done, as model/outgoingStates says for the talk */
  show: OutShow
  /** its pictures, as they were picked (shown while they go up) */
  previews?: string[]
  /** its voice notes: in the bubble while it goes, not yet to play */
  voices?: FileRef[]
}

export interface TalkFacts {
  /** the inputs your messages came from */
  inputs: ReadonlyMap<string, Input>
  /** hidden messages shown for now */
  peeking: ReadonlySet<number>
  /** the question being answered again */
  reask: number | null
  /** an answer on its way: its words, and where it is as its question's card says it */
  going: { text: string; card: OutShow } | null
  /** what you sent to this item and Taska has not yet */
  outgoing: Outgoing[]
  /** what became of an input your messages came from (model/became) */
  became(id: string): Became | null
  /** the items an input made, besides the item it was said in (B714 #10594) */
  made(id: string): readonly ItemRef[]
}

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
      {there ? (
        <>
          {' on '}
          <button onClick={() => on.ref(there)} className="font-mono text-blue-600 hover:underline dark:text-blue-400">
            {there}
          </button>
        </>
      ) : null}
    </span>
  )
}

/** A message in the talk, drawn as what it is: yours, an agent taking back its question, a question taken back, one
 * hidden, a question answered (its card), or an agent's. */
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
  if (x.by === 'you') return <YourMessage x={x} env={env} on={on} facts={facts} ver={ver} read={read} />
  if (x.kind === 'withdraw') return <TookBack x={x} env={env} on={on} />
  if (gone) return <Withdrawn x={x} env={env} />
  if (x.hidden && !facts.peeking.has(x.id)) return <Hidden x={x} env={env} on={on} />
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
        going={facts.going && it.thread.filter((m) => m.kind === 'ask').at(-1)?.id === x.id ? facts.going.card : null}
      />
    )
  return <AgentMessage it={it} x={x} env={env} on={on} facts={facts} docs={docs} code={code} done={done} />
}

/** Your words: in blue on the right, with what became of the input they came from. */
function YourMessage({ x, env, on, facts, ver, read }: { x: Message; env: TalkEnv; on: TalkLineEvents; facts: TalkFacts; ver?: Version; read: { names: string[]; t: number } | null }) {
  const src = x.src ? facts.inputs.get(x.src) : undefined
  const y = ver ? { ...x, text: ver.text } : x
  const strip = (files: FileRef[] | undefined) => (files?.length ? <FileRows files={files} url={env.url} play={env.play} tidy={env.tidy} on={on} cls="items-end max-w-full [&>div]:max-w-full" /> : null)
  if (y.text && y.text.trim().split('\n').every((l) => /^\s*✓/.test(l)) && !src?.files?.length) return null // an answer's ticks show on its card
  // what became of the input it came from, as the talk shows it (model/inputStates): moved, what it made, its words
  // still to come
  const b = src ? facts.became(src.id) : null
  const shown = b && showsIn(b, 'talk') ? b : null
  const moved = shown?.k === 'moved' && !ver?.old ? shown : null
  // B714 #10594: what your words here made, as one line under them; the same on the phone and the desktop
  const made = src && shown?.k === 'filed' && !ver?.old ? facts.made(src.id) : []
  // your voice notes inside your bubble, under your words (T668); an earlier version shows its words only
  const voices = ver?.old ? [] : (src?.files || []).filter(isAudio)
  const mark = shown?.k === 'transcribing' ? becameText(shown, 'talk') : null
  return (
    <div className={`group group/msg flex scroll-mb-4 flex-col items-end gap-1 rounded-2xl ${ver?.old ? 'opacity-60' : ''}`}>
      {voices.length ? (
        <VoiceBubble
          cls={YOU_BUBBLE}
          files={voices}
          url={env.url}
          play={env.play}
          tidy={env.tidy}
          top={y.text ? <MsgText x={y} env={env} on={on} /> : null}
          hearing={mark}
          attrs={voiceMark(src)}
          on={on}
        />
      ) : y.text ? (
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
      {/* one line under what you wrote: when, and ⋯ with Edit, Add more and the rest */}
      <div className="flex flex-wrap items-center justify-end gap-x-1">
        <span className={`px-1 text-[11px] ${MUTED}`}>
          {ver?.old ? 'earlier version · ' : ver?.label ? ver.label + ' · ' : ''}
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
          {moved ? (
            <>
              {' · '}
              <a
                href={moved.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return
                  e.preventDefault()
                  on.moved(moved.href)
                }}
                className="relative font-medium text-zinc-500 underline decoration-dotted underline-offset-2 after:absolute after:-inset-3 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                {becameText(moved, 'talk')}
              </a>
            </>
          ) : null}
          {mark && !voices.length ? (
            <>
              {' · '}
              <span className="animate-pulse text-blue-600 dark:text-blue-400">{mark}…</span>
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
        {src && !ver?.old && !src.moved ? (
          <button aria-label={`More for ${inputCode(src.id)}`} onClick={(e) => on.inputMore(src.id, e.currentTarget)} className={`${DC_BTN} min-w-11 justify-center order-first lg:opacity-0 lg:group-hover/msg:opacity-100 lg:focus-visible:opacity-100`}>
            <Icon n="more" c="size-3.5" />
          </button>
        ) : null}
      </div>
      {made.length ? (
        <div className={`px-1 text-[11px] ${MUTED}`}>
          → {MADE_WORD}{' '}
          {made.map((y, i) => (
            <Fragment key={y.n}>
              {i ? ', ' : ''}
              <button onClick={() => on.ref(y.code)} title={y.title} className="relative font-mono font-medium text-blue-600 after:absolute after:-inset-2 hover:underline dark:text-blue-400">
                {y.code}
              </button>
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** An agent took back its question. */
function TookBack({ x, env, on }: { x: Message; env: TalkEnv; on: TalkLineEvents }) {
  return (
    <div className="flex items-start gap-2 px-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
      <Icon n="undo" c="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">{whoName(x.by)} took back its question</span> <span className={`text-[11px] ${MUTED}`}>{when(x.t, env.now)}</span>
        {x.text.trim() ? <Rich text={x.text} world={env.world} cls="mt-0.5" onRef={on.ref} onPicture={on.picture} /> : null}
      </div>
    </div>
  )
}

// on the phone the message's More sits at the header's far right, where your own messages and the question cards
// have theirs; the time stays beside the name (D115 #4)
function AgentHead({ x, end, children }: { x: Message; end?: ReactNode; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2 self-stretch px-1 text-[11px] ${MUTED}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 whitespace-nowrap phone:flex-1">
        <Avatar by={x.by} />
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{whoName(x.by)}</span>
        {x.ses ? <span className="-ml-1 text-xs text-zinc-500 dark:text-zinc-400">· {x.ses}</span> : null}
        {x.to?.length ? <span className="text-xs text-zinc-500 dark:text-zinc-400">→ {x.to.join(', ')}</span> : null}
        {children}
      </div>
      {end}
    </div>
  )
}

/** A question the agent took back: struck through, faded. */
function Withdrawn({ x, env }: { x: Message; env: TalkEnv }) {
  return (
    <div className="flex flex-col items-start gap-1.5 opacity-60">
      <AgentHead x={x}>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">Withdrawn</span>
        <span>{when(x.t, env.now)}</span>
      </AgentHead>
      <div className="w-full rounded-2xl rounded-tl-md border border-dashed border-zinc-300 px-4 py-3 text-[15px] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <div className="line-clamp-2 line-through decoration-zinc-400 dark:decoration-zinc-500">{oneLine(x.text)}</div>
      </div>
    </div>
  )
}

/** A hidden message: one line, to show it. */
function Hidden({ x, env, on }: { x: Message; env: TalkEnv; on: TalkLineEvents }) {
  return (
    <button onClick={() => on.peek(x.id)} className={`relative flex items-center gap-1.5 self-start px-1 after:absolute after:inset-x-0 after:-inset-y-3.5 text-[12px] hover:text-zinc-600 dark:hover:text-zinc-300 ${MUTED}`}>
      {whoName(x.by)} · hidden message · {when(x.t, env.now)} · Show
    </button>
  )
}

/** An agent's (or the organizer's) message: a card under its name. */
function AgentMessage({ it, x, env, on, facts, docs, code, done }: { it: Item; x: Message; env: TalkEnv; on: TalkLineEvents; facts: TalkFacts; docs: readonly Doc[]; code(n: number | null): string; done: string[] | null }) {
  return (
    <div className="group/msg flex flex-col items-start gap-1.5">
      <AgentHead
        x={x}
        end={
          <button aria-label="More for this message" onClick={(e) => on.msgMenu(x.id, e.currentTarget)} className={`${DC_BTN} min-w-9 shrink-0 justify-center lg:opacity-0 lg:group-hover/msg:opacity-100 lg:focus-visible:opacity-100`}>
            <Icon n="more" c="size-3.5" />
          </button>
        }
      >
        {x.by === 'org' && x.src ? <FromInput r={facts.inputs.get(x.src)} n={it.n} code={code} on={on} /> : null}
        {done ? (
          // answered by your words: as the cards say it (Replied; Skipped where the choices were in a document)
          <span className="flex items-center gap-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <Icon n="reply" c="size-3" sw="2.5" />
            {pickInDoc(x, docs) ? 'Skipped · you replied' : 'Replied'}
          </span>
        ) : (
          <KindTag x={x} />
        )}
        <span className="-ml-1 flex items-center gap-2">
          · {when(x.t, env.now)}
          {x.hidden ? (
            <button onClick={() => on.unhide(x.id)} className={DC_LINK}>
              Unhide
            </button>
          ) : null}
        </span>
      </AgentHead>
      <div className="w-full rounded-2xl rounded-tl-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <MsgText x={x} env={env} on={on} done={done} />
        {x.files?.length ? <FileRows files={x.files} url={env.url} size="h-48 w-24" play={env.play} tidy={env.tidy} on={on} cls="mt-3" /> : null}
      </div>
    </div>
  )
}

const PENDING_TONE: Record<OutTone, string> = {
  busy: 'animate-pulse text-blue-600 dark:text-blue-400',
  partial: 'text-amber-700 dark:text-amber-400',
  failed: 'text-red-600 dark:text-red-400',
}

/** What you sent to this item, in the talk at once, saying where it is and what can be done (model/outgoingStates),
 * until Taska has it; faded while it waits or Taska said no. */
function Pending({ list, env, on }: { list: Outgoing[]; env: TalkEnv; on: TalkLineEvents }) {
  return (
    <>
      {list.map((q) => {
        const faded = q.show.tone === 'busy' ? '' : 'opacity-70'
        return (
          <div key={q.q} className="flex flex-col items-end gap-1">
            {q.voices?.length ? (
              <VoiceBubble cls={YOU_BUBBLE} files={q.voices} url={env.url} play={env.play} tidy={env.tidy} top={q.text ? <Rich text={q.text} world={env.world} onRef={on.ref} onPicture={on.picture} /> : null} busy on={on} />
            ) : q.text ? (
              // on its way, its words as they will read once sent (Markdown, r1099)
              <div className={`${YOU_BUBBLE} ${faded}`}>
                <Rich text={q.text} world={env.world} onRef={on.ref} onPicture={on.picture} />
              </div>
            ) : null}
            {q.previews?.length ? (
              <div className={`flex max-w-full flex-wrap justify-end gap-2 ${faded}`}>
                {q.previews.map((src, i) => (
                  <img key={i} src={src} alt="" className="size-20 rounded-lg border border-zinc-200 bg-zinc-50 object-cover dark:border-zinc-700 dark:bg-zinc-900" />
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-x-1">
              <span className={`px-1 text-[11px] ${MUTED}`}>
                <span className={PENDING_TONE[q.show.tone]}>{q.show.say}</span>
              </span>
              {q.show.acts.includes('retry') ? (
                <button onClick={() => on.outboxRetry(q.q)} className={DC_LINK}>
                  {OUT_ACT_WORD.retry}
                </button>
              ) : null}
              {q.show.acts.includes('edit') ? (
                <button onClick={() => on.outboxEdit(q.q)} className={DC_LINK}>
                  {OUT_ACT_WORD.edit}
                </button>
              ) : null}
              {q.show.acts.includes('cancel') ? (
                <button onClick={() => on.cancel(q.q)} aria-label="Cancel" title="Cancel: it is not sent" className={`${DC_BTN} min-w-11 justify-center`}>
                  <Icon n="x" c="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** The talk's messages (from the first one shown), the documents' comments among them, the card where its message is. */
export function Talk({ it, list, notes, card, env, on, facts, docs, code }: {
  it: Item
  list: readonly Message[]
  notes: readonly DocNote[]
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
    for (; k < notes.length && (!t || notes[k].c.t < t); k++) {
      const n = notes[k]
      out.push(<DocComment key={`dn${n.d}-${n.c.id}`} n={n} env={env} on={on} />)
    }
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
  out.push(<Pending key="pending" list={facts.outgoing} env={env} on={on} />)
  return <>{out}</>
}

