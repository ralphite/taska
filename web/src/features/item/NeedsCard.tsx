// What waits on you, as a card: the question with its choices, the proposal, the finished work. The same frame before
// and after you answer (amber while it waits for you, grey once answered), so nothing moves: what you chose ticked,
// the other quieter, and Modify to choose again. Props only.

import type { ReactNode } from 'react'
import { lastAgentMessage } from '../../model/items'
import { askRowOf } from '../../model/talk'
import { hasChoices } from '../../model/markdown'
import { ITEM_ACTS, pastOf, type ItemActId } from '../../model/itemActs'
import { chosenAct, DECISION, NEED_STATES, needOf, type Need } from '../../model/needStates'
import { when } from '../../model/time'
import type { Item, Message } from '../../model/types'
import { hasIcon } from '../../model/words'
import { Kbd, Who } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import { Rich } from '../../ui/Markdown'
import { DECIDED_OFF, DECIDED_ON, MODIFY_LINK, MUTED, NEED, NEEDS_CARD, PRIMARY_BASE, SECOND, actIcon, chosenTone } from '../../ui/tones'
import { Thumbs } from '../../ui/Files'
import { MsgText } from './MsgText'
import { AskRowCard } from './AskRowCard'
import type { OutShow, OutTone } from '../../model/outgoingStates'
import type { TalkEnv, TalkEvents } from './talkEnv'

export interface CardEvents extends TalkEvents {
  /** Approve (open), Won't do (dropped), Accept (done) */
  decide(n: number, status: 'open' | 'dropped' | 'done'): void
  /** Not yet: back in progress */
  notYet(n: number): void
  /** choose again what you decided; cancel leaves it as it was */
  modify(n: number): void
  cancelModify(): void
  sendAnswer(n: number): void
  /** your answers to some of the questions in a row (`of`), as one reply (B749) */
  sendRow(n: number, of: number[], text: string): void
  /** answer a question again; cancel leaves the answer as it was */
  reask(n: number, id: number): void
  cancelReask(): void
}

/** Who asks: the agent by its app's icon where it has one, then its session (T711). */
export const msgName = (x: { by: string; ses?: string | null }) => (
  <>
    <Who by={x.by} />
    {x.ses ? `${hasIcon(x.by) ? ' ' : ' · '}${x.ses}` : ''}
  </>
)

/** A question's words, the card's most prominent (T642 R9): its paragraphs a step larger and heavier than the rest. */
const QUESTION = '[&>p]:text-[16px] [&>p]:font-medium'

const GOING_TONE: Record<OutTone, string> = { busy: 'animate-pulse text-blue-600 dark:text-blue-400', partial: 'text-amber-700 dark:text-amber-400', failed: 'text-red-600 dark:text-red-400' }

export function NeedFrame({ icon, title, t, done = false, quiet = false, body, foot, hint = '', going = null, act = null, now }: {
  icon: IconName
  title: ReactNode
  t?: string
  done?: boolean
  /** the title only says who asks: faint and plain, like the time beside it, so the question under it stands out */
  quiet?: boolean
  body: ReactNode
  foot: ReactNode
  hint?: string
  /** an answer on its way says where it is where the time goes, until Taska has it (model/outgoingStates) */
  going?: OutShow | null
  act?: ReactNode
  now: number
}) {
  return (
    <section className={`w-full rounded-2xl border ${done ? 'group/form border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900' : NEEDS_CARD}`}>
      <div className="flex items-center gap-2.5 px-4 pt-3.5 lg:px-5 lg:pt-4">
        <Icon n={icon} c={`size-5 ${done ? 'text-zinc-400 dark:text-zinc-500' : 'text-amber-600 dark:text-amber-400'}`} />
        <p
          className={`min-w-0 flex-1 text-sm ${
            quiet ? MUTED : `font-semibold lg:text-[15px] ${done ? 'text-zinc-600 dark:text-zinc-300' : 'text-amber-900 dark:text-amber-200'}`
          }`}
        >
          {title}
        </p>
        {act}
        {going ? (
          <span className={`text-xs ${GOING_TONE[going.tone]}`}>{going.say}</span>
        ) : t ? (
          <span className={`text-xs ${act ? 'hidden lg:inline' : ''} ${done ? ' ' : 'text-amber-700/80 dark:text-amber-300/70'} ${MUTED}`}>{when(t, now)}</span>
        ) : null}
      </div>
      {body ? <div className="space-y-2 px-4 pt-2 text-[15px] leading-relaxed text-zinc-800 lg:px-5 lg:pl-12 dark:text-zinc-200">{body}</div> : null}
      {foot ? (
        <>
          {/* the phone: how to answer on a line of its own, over the buttons */}
          {hint ? <p className="px-4 pt-2 text-xs text-amber-700/80 lg:hidden dark:text-amber-300/70">{hint}</p> : null}
          <div className="flex min-h-[4.25rem] items-center gap-2.5 p-3 pt-3.5 lg:justify-end lg:px-5 lg:pb-4">
            {hint ? <p className="mr-auto hidden text-xs text-amber-700/80 lg:block dark:text-amber-300/70">{hint}</p> : null}
            {foot}
          </div>
        </>
      ) : hint ? (
        <p className="px-4 pt-2 pb-3.5 text-xs text-amber-700/80 lg:px-5 lg:pl-12 dark:text-amber-300/70">{hint}</p>
      ) : (
        <div className="h-3.5" />
      )}
    </section>
  )
}


/** A decision button's word, as wide as the widest it can say (to decide, decided; bold), stacked unseen in one cell:
 * the button keeps its width and place when you decide (r1003). */
const Word = ({ shown, all }: { shown: string; all: readonly string[] }) => (
  <span className="grid justify-items-center whitespace-nowrap">
    <span className="col-start-1 row-start-1">{shown}</span>
    {all.map((w) => (
      <span key={w} aria-hidden className="invisible col-start-1 row-start-1 font-semibold">
        {w}
      </span>
    ))}
  </span>
)
/** a choice's words: now and done */
const both = (act: ItemActId) => [ITEM_ACTS[act].label, pastOf(act)]
/** Approve or Accept beside an answered question: its words, and what deciding may make it say */
const keepWords = (from: string): readonly string[] => {
  const x = DECISION[from === 'proposed' ? 'proposal' : 'work']
  return [ITEM_ACTS[x.yes.act].label, pastOf(x.yes.act), pastOf(x.no.act)]
}

/** Approve or Accept as well as answering (a button like any other while it can be pressed); decided, it says what you
 * chose (`need`: what the item needs from you, model/needStates). */
export function KeepBtn({ it, need, on }: { it: Item; need: Need; on: CardEvents }) {
  if (need.keep === 'decided' && need.dec) {
    // decided: the same button where it was, disabled, its word said as done in its colour (D106 #4.3, r1003)
    const w = chosenAct(need.dec)
    return (
      <button disabled aria-pressed className={DECIDED_ON(chosenTone(w))}>
        <Icon n={actIcon(w, true)} c="size-4" sw="2.25" />
        <Word shown={pastOf(w)} all={keepWords(need.dec.from)} />
      </button>
    )
  }
  // still to be pressed beside an answered question: a button like any other
  if (need.keep !== 'decide' || !need.of) return null
  const { status, yes } = DECISION[need.of]
  return (
    <button onClick={() => on.decide(it.n, yes.to)} className={SECOND}>
      <Icon n={actIcon(yes.act, true)} c="size-4" sw="2.25" />
      <Word shown={ITEM_ACTS[yes.act].label} all={keepWords(status)} />
    </button>
  )
}

export const SendAnswerBtn = ({ n, picked, cls, keyHint = false, on }: { n: number; picked: boolean; cls: string; keyHint?: boolean; on: CardEvents }) => (
  <button disabled={!picked} onClick={() => on.sendAnswer(n)} className={`${PRIMARY_BASE} ${NEED.answer.btn} whitespace-nowrap ${cls}`}>
    Send answer
    {keyHint ? <Kbd k="⌘↵" /> : null}
  </button>
)

/** A decision's two buttons, in their order: no, then yes (the status each sets, its action). */
const pairsOf = (from: string): readonly (readonly [status: string, act: ItemActId])[] => {
  const x = DECISION[from === 'proposed' ? 'proposal' : 'work']
  return [
    [x.no.to, x.no.act],
    [x.yes.to, x.yes.act],
  ]
}

/** A decision's two buttons to press: no, a quieter one; yes, in what it needs from you's colour. */
function DecideBtns({ from, press }: { from: string; press(status: string): void }) {
  const tone = NEED[from === 'proposed' ? 'approve' : 'accept'].btn
  return pairsOf(from).map(([v, act], i) => (
    <button key={v} onClick={() => press(v)} className={`${i ? `${PRIMARY_BASE} ${tone} flex-[1.4]` : `${SECOND} flex-1`} lg:flex-none`}>
      <Icon n={actIcon(act, true)} c={i ? 'size-4.5' : 'size-4'} sw="2.25" />
      <Word shown={ITEM_ACTS[act].label} all={both(act)} />
      <Kbd k={ITEM_ACTS[act].key ?? ''} />
    </button>
  ))
}

export function NeedsCard({ it, env, on, remodify, going = null, rowGoing = null }: {
  it: Item
  env: TalkEnv
  on: CardEvents
  /** your decision on it is open to choose again */
  remodify: boolean
  /** an answer to its question on its way: its words */
  going?: string | null
  /** an answer to some of its questions in a row on its way: which, and where it is */
  rowGoing?: { of: readonly number[]; card: OutShow } | null
}) {
  const n = it.n
  // what it needs from you, and so which card (model/needStates)
  const need = needOf(it, going)
  const kind = NEED_STATES[need.state].card
  const m = need.msg
  const name = msgName(m || it.wait || { by: it.by && it.by !== 'you' ? it.by : 'agent' })
  const text = (x: Message) => <MsgText x={x} env={env} on={on} whole />
  const card = (icon: IconName, title: ReactNode, body: ReactNode, buttons: ReactNode, hint = '') => (
    <NeedFrame icon={icon} title={title} t={m?.t} quiet={icon === 'ask'} body={body} foot={buttons} hint={hint} now={env.now} />
  )
  // questions in a row: one card (B749)
  const row = kind === 'question' ? askRowOf(it.thread, it.wait?.id) : null
  if (row) return <AskRowCard it={it} row={row} env={env} on={on} going={rowGoing} />
  if (kind === 'question' && it.wait) {
    const w = it.wait
    const choices = hasChoices(w.text)
    const asking = env.choosing
    const body = (
      <>
        <Rich text={w.text} world={env.world} cls={`${QUESTION} text-zinc-900 dark:text-zinc-100`} choosing={asking} onRef={on.ref} onPicture={on.picture} />
        {w.files?.length ? (
          <div className="flex gap-2 overflow-x-auto lg:scrollbar-thin">
            <Thumbs files={w.files} url={env.url} size="h-48 w-24" play={env.play} tidy={env.tidy} on={on} />
          </div>
        ) : null}
      </>
    )
    const keep = need.keep != null
    return card(
      'ask',
      <>{msgName(w)} asks you</>,
      body,
      keep || choices ? (
        <>
          <KeepBtn it={it} need={need} on={on} />
          {choices ? <SendAnswerBtn n={n} picked={!!asking?.picked.size} cls="flex-[1.4] lg:flex-none" keyHint on={on} /> : null}
        </>
      ) : null,
      choices ? '' : '↓ Answer below',
    )
  }
  if (kind === 'decided' && need.dec) {
    const dec = need.dec
    const x = need.msg ?? undefined
    const pairs = pairsOf(dec.from)
    const title = <>{msgName(x || { by: it.by && it.by !== 'you' ? it.by : 'agent' })} {dec.from === 'proposed' ? 'proposed this' : 'finished this'}</>
    const chose = (v: string) => dec.to === v || (v === 'open' && dec.from === 'proposed' && dec.to !== 'dropped')
    if (remodify)
      return (
        <NeedFrame
          icon={dec.from === 'proposed' ? 'propose' : 'done'}
          title={title}
          t={x?.t}
          now={env.now}
          act={
            <button onClick={on.cancelModify} className={MODIFY_LINK.replace(/lg:opacity-0\S*|lg:group-hover\S*/g, '')}>
              Cancel
            </button>
          }
          body={x ? text(x) : null}
          foot={<DecideBtns from={dec.from} press={(v) => (chose(v) ? on.cancelModify() : v === 'open' && dec.from === 'review' ? on.notYet(n) : on.decide(n, v as 'open' | 'dropped' | 'done'))} />}
        />
      )
    // decided: the card keeps its look and its buttons where they were (r1003), done like a sent form (r1007): both
    // greyed and disabled (the not-allowed cursor, no hover, out of the keys), what you chose said as done; Edit, under
    // the pointer on the desktop, opens them again
    return (
      <NeedFrame
        icon={dec.from === 'proposed' ? 'propose' : 'done'}
        title={title}
        t={x?.t}
        now={env.now}
        done
        act={
          <button onClick={() => on.modify(n)} className={MODIFY_LINK}>
            Edit
          </button>
        }
        body={x ? text(x) : null}
        foot={pairs.map(([v, act], i) => (
          <button key={v} disabled aria-pressed={chose(v)} className={`${chose(v) ? DECIDED_ON(chosenTone(act)) : DECIDED_OFF} ${i ? 'flex-[1.4]' : 'flex-1'} lg:flex-none`}>
            <Icon n={actIcon(act, true)} c={i ? 'size-4.5' : 'size-4'} sw="2.25" />
            <Word shown={chose(v) ? pastOf(act) : ITEM_ACTS[act].label} all={both(act)} />
            {/* decided: no key does anything now, so none shows (its place kept, as on an answered card) */}
            <span className="invisible">
              <Kbd k={ITEM_ACTS[act].key ?? ''} />
            </span>
          </button>
        ))}
      />
    )
  }
  // onQuestion: the answered question's card holds Approve / Accept, where it was
  if (kind === 'replied' && need.of)
    return card(
      need.of === 'proposal' ? 'propose' : 'done',
      <>{name} {DECISION[need.of].did}</>,
      m ? text(m) : null,
      <>
        {/* what you did (you replied), done; Approve / Accept still to be pressed */}
        <button disabled aria-pressed className={`${DECIDED_ON(chosenTone('reply'))} flex-1 lg:flex-none`}>
          <Icon n="reply" c="size-4" sw="2.25" />
          Skipped · you replied
        </button>
        <KeepBtn it={it} need={need} on={on} />
      </>,
    )
  if (kind === 'decide' && need.of === 'proposal')
    return card(
      'propose',
      <>{name} proposed this</>,
      m ? text(m) : null,
      <DecideBtns from="proposed" press={(v) => on.decide(n, v as 'open' | 'dropped')} />,
    )
  if (kind === 'decide' && need.of === 'work')
    return card(
      'done',
      <>{name} finished this</>,
      m ? text(m) : null,
      <DecideBtns from="review" press={(v) => (v === 'done' ? on.decide(n, 'done') : on.notYet(n))} />,
    )
  return null
}

/** An answered question, in the card it was asked in, its layout as it was (r1003): your picks ticked, Send answer
 * where it was said as Sent (Replied when you wrote instead), greyed and not to be clicked, and Edit (under the
 * pointer on the desktop) to pick again (r1007). */
export function Answered({ it, x, done, env, on, reasking, going = null }: {
  it: Item
  x: Message
  done: readonly string[]
  env: TalkEnv
  on: CardEvents
  /** being answered again: a form again */
  reasking: boolean
  /** an answer on its way: where it is */
  going?: OutShow | null
}) {
  // the latest question you answered holds the item's Approve or Accept, or what you chose there
  const need = needOf(it)
  const last = NEED_STATES[need.state].card === 'onQuestion' && lastAgentMessage(it)?.id === x.id
  if (reasking)
    return (
      <NeedFrame
        icon="ask"
        title={<>{msgName(x)} asks you</>}
        t={x.t}
        now={env.now}
        quiet
        // Cancel in the head, as when a decision is changed: the buttons keep one line on the phone
        act={
          <button onClick={on.cancelReask} className={MODIFY_LINK.replace(/lg:opacity-0\S*|lg:group-hover\S*/g, '')}>
            Cancel
          </button>
        }
        body={<Rich text={x.text} world={env.world} cls={`${QUESTION} text-zinc-900 dark:text-zinc-100`} choosing={env.choosing} onRef={on.ref} onPicture={on.picture} />}
        foot={
          <>
            {last ? <KeepBtn it={it} need={need} on={on} /> : null}
            <SendAnswerBtn n={it.n} picked={!!env.choosing?.picked.size} cls="flex-[1.4] lg:flex-none" keyHint on={on} />
          </>
        }
      />
    )
  return (
    <NeedFrame
      icon="ask"
      title={<>{msgName(x)} asks you</>}
      t={x.t}
      now={env.now}
      going={going}
      done
      quiet
      // no Edit while the new answer is on its way: it comes back once Taska has it (D115 #5)
      act={
        going ? null : (
          <button onClick={() => on.reask(it.n, x.id)} className={MODIFY_LINK}>
            Edit
          </button>
        )
      }
      body={<Rich text={x.text} world={env.world} cls={`${QUESTION} text-zinc-600 dark:text-zinc-300`} done={done} onRef={on.ref} onPicture={on.picture} />}
      foot={
        <>
          {last ? <KeepBtn it={it} need={need} on={on} /> : null}
          {/* Send answer where it was: on its way still Send answer, not to be clicked; Taska has it, said as done and a
              little greyed (r1003) */}
          {going ? (
            <button disabled className={`${PRIMARY_BASE} ${NEED.answer.btn} flex-[1.4] lg:flex-none`}>
              Send answer
              <span className="invisible">
                <Kbd k="⌘↵" />
              </span>
            </button>
          ) : (
            <button disabled aria-pressed className={`${DECIDED_ON(chosenTone('answer'))} flex-[1.4] lg:flex-none`}>
              <Icon n={done.length ? 'check' : 'reply'} c="size-4" sw="2.25" />
              {done.length ? 'Sent' : 'Replied'}
              <span className="invisible">
                <Kbd k="⌘↵" />
              </span>
            </button>
          )}
        </>
      }
    />
  )
}
