// What waits on you, as a card: the question with its choices, the proposal, the finished work. The same frame before
// and after you answer (amber while it waits for you, grey once answered), so nothing moves: what you chose ticked,
// the other quieter, and Modify to choose again. Props only.

import type { ReactNode } from 'react'
import { lastAgentMessage, userWord } from '../../model/items'
import { hasChoices } from '../../model/markdown'
import { answeredLast, chosenWord, decidedCard, decidedStill, heldMessage } from '../../model/talk'
import { when } from '../../model/time'
import type { Item, Message } from '../../model/types'
import { whoName } from '../../model/words'
import { Kbd } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import { Rich } from '../../ui/Markdown'
import { ACT_ICON, CHOSEN_TONE, DECIDED_OFF, DECIDED_ON, MODIFY_LINK, NEED, NEEDS_CARD, PRIMARY_BASE, SECOND } from '../../ui/tones'
import { Thumbs } from '../../ui/Files'
import { MsgText } from './MsgText'
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
  /** answer a question again; cancel leaves the answer as it was */
  reask(n: number, id: number): void
  cancelReask(): void
}

const msgName = (x: { by: string; ses?: string | null }) => whoName(x.by) + (x.ses ? ` · ${x.ses}` : '')

export function NeedFrame({ icon, title, t, done = false, body, foot, hint = '', going = '', act = null, now }: {
  icon: IconName
  title: string
  t?: string
  done?: boolean
  body: ReactNode
  foot: ReactNode
  hint?: string
  /** an answer on its way says so where the time goes, until Taska has it */
  going?: string
  act?: ReactNode
  now: number
}) {
  return (
    <section className={`w-full rounded-2xl border ${done ? 'group/form border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900' : NEEDS_CARD}`}>
      <div className="flex items-center gap-2.5 px-4 pt-3.5 lg:px-5 lg:pt-4">
        <Icon n={icon} c={`size-5 ${done ? 'text-zinc-400 dark:text-zinc-500' : 'text-amber-600 dark:text-amber-400'}`} />
        <p className={`min-w-0 flex-1 text-sm font-semibold lg:text-[15px] ${done ? 'text-zinc-600 dark:text-zinc-300' : 'text-amber-900 dark:text-amber-200'}`}>{title}</p>
        {act}
        {going ? (
          <span className="animate-pulse text-xs text-blue-600 dark:text-blue-400">{going}</span>
        ) : t ? (
          <span className={`text-xs ${act ? 'hidden lg:inline' : ''} ${done ? 'text-zinc-400 dark:text-zinc-500' : 'text-amber-700/80 dark:text-amber-300/70'}`}>{when(t, now)}</span>
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

/** A decision's button word once it is made. */
const PAST: Record<string, string> = { Approve: 'Approved', Accept: 'Accepted', "Won't do": 'Declined', 'Not yet': 'Sent back' }

/** Approve or Accept as well as answering (a button like any other while it can be pressed); decided, it says what you
 * chose. */
export function KeepBtn({ it, on }: { it: Item; on: CardEvents }) {
  if (decidedStill(it) && it.decided) {
    // decided: the same button where it was, disabled, its word said as done in its colour (D106 #4.3, r1003)
    const w = chosenWord(it.decided)
    return (
      <button disabled aria-pressed className={DECIDED_ON(CHOSEN_TONE[w] ?? CHOSEN_TONE.Reply)}>
        <Icon n={ACT_ICON[w]} c="size-4" sw="2.25" />
        {PAST[w] ?? w}
      </button>
    )
  }
  // still to be pressed beside an answered question: a button like any other
  if (it.status === 'proposed')
    return (
      <button onClick={() => on.decide(it.n, 'open')} className={SECOND}>
        <Icon n="thumb" c="size-4" />
        Approve
      </button>
    )
  if (it.status === 'review')
    return (
      <button onClick={() => on.decide(it.n, 'done')} className={SECOND}>
        <Icon n="check" c="size-4" sw="2.25" />
        Accept
      </button>
    )
  return null
}

export const SendAnswerBtn = ({ n, picked, cls, keyHint = false, on }: { n: number; picked: boolean; cls: string; keyHint?: boolean; on: CardEvents }) => (
  <button disabled={!picked} onClick={() => on.sendAnswer(n)} className={`${PRIMARY_BASE} ${NEED.answer.btn} whitespace-nowrap ${cls}`}>
    Send answer
    {keyHint ? <Kbd k="⌘↵" /> : null}
  </button>
)

type Pair = readonly [status: string, icon: IconName, label: string, key: string]
const PROPOSED: readonly Pair[] = [
  ['dropped', 'ban', "Won't do", 'W'],
  ['open', 'thumb', 'Approve', 'A'],
]
const FINISHED: readonly Pair[] = [
  ['open', 'reopen', 'Not yet', 'N'],
  ['done', 'check', 'Accept', 'A'],
]

export function NeedsCard({ it, env, on, remodify, going = null }: {
  it: Item
  env: TalkEnv
  on: CardEvents
  /** your decision on it is open to choose again */
  remodify: boolean
  /** an answer to its question on its way: its words */
  going?: string | null
}) {
  const n = it.n
  const m = heldMessage(it)
  const name = msgName(m || it.wait || { by: it.by && it.by !== 'you' ? it.by : 'agent' })
  const text = (x: Message) => <MsgText x={x} env={env} on={on} whole />
  const card = (icon: IconName, title: string, body: ReactNode, buttons: ReactNode, hint = '') => (
    <NeedFrame icon={icon} title={title} t={m?.t} body={body} foot={buttons} hint={hint} now={env.now} />
  )
  if (it.wait) {
    const w = it.wait
    const choices = hasChoices(w.text)
    const asking = env.choosing
    const body = (
      <>
        <Rich text={w.text} world={env.world} cls="text-zinc-900 dark:text-zinc-100" choosing={asking} onRef={on.ref} onPicture={on.picture} />
        {w.files?.length ? (
          <div className="flex gap-2 overflow-x-auto lg:scrollbar-thin">
            <Thumbs files={w.files} url={env.url} size="h-48 w-24" play={env.play} tidy={env.tidy} on={on} />
          </div>
        ) : null}
      </>
    )
    const keep = it.status === 'proposed' || it.status === 'review'
    return card(
      'ask',
      `${msgName(w)} asks you`,
      body,
      keep || choices ? (
        <>
          <KeepBtn it={it} on={on} />
          {choices ? <SendAnswerBtn n={n} picked={!!asking?.picked.size} cls="flex-[1.4] lg:flex-none" keyHint on={on} /> : null}
        </>
      ) : null,
      choices ? '' : '↓ Answer below',
    )
  }
  const dc = decidedCard(it)
  if (dc) {
    const { dec, x } = dc
    const pairs = dec.from === 'proposed' ? PROPOSED : FINISHED
    const tone = NEED[dec.from === 'proposed' ? 'approve' : 'accept'].btn
    const title = `${msgName(x || { by: it.by && it.by !== 'you' ? it.by : 'agent' })} ${dec.from === 'proposed' ? 'proposed this' : 'finished this'}`
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
          foot={pairs.map(([v, icon, label, k], i) => (
            <button
              key={v}
              onClick={() => (chose(v) ? on.cancelModify() : v === 'open' && dec.from === 'review' ? on.notYet(n) : on.decide(n, v as 'open' | 'dropped' | 'done'))}
              className={`${i ? `${PRIMARY_BASE} ${tone} flex-[1.4]` : `${SECOND} flex-1`} lg:flex-none`}
            >
              <Icon n={icon} c={i ? 'size-4.5' : 'size-4'} sw="2.25" />
              {label}
              <Kbd k={k} />
            </button>
          ))}
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
        foot={pairs.map(([v, icon, label, k], i) => (
          <button key={v} disabled aria-pressed={chose(v)} className={`${chose(v) ? DECIDED_ON(CHOSEN_TONE[label]) : DECIDED_OFF} ${i ? 'flex-[1.4]' : 'flex-1'} lg:flex-none`}>
            <Icon n={icon} c={i ? 'size-4.5' : 'size-4'} sw="2.25" />
            {chose(v) ? (PAST[label] ?? label) : label}
            <Kbd k={k} />
          </button>
        ))}
      />
    )
  }
  if (answeredLast(it, going)) return null // the answered question's card holds Approve / Accept, where it was
  const said = it.thread.at(-1)
  if ((it.status === 'proposed' || it.status === 'review') && (it.talked || (said && userWord(said))))
    return card(
      it.status === 'proposed' ? 'propose' : 'done',
      `${name} ${it.status === 'proposed' ? 'proposed this' : 'finished this'}`,
      m ? text(m) : null,
      <>
        {/* what you did (you replied), done; Approve / Accept still to be pressed */}
        <button disabled aria-pressed className={`${DECIDED_ON(CHOSEN_TONE.Reply)} flex-1 lg:flex-none`}>
          <Icon n="reply" c="size-4" sw="2.25" />
          Skipped · you replied
        </button>
        <KeepBtn it={it} on={on} />
      </>,
    )
  if (it.status === 'proposed')
    return card(
      'propose',
      `${name} proposed this`,
      m ? text(m) : null,
      <>
        <button onClick={() => on.decide(n, 'dropped')} className={`${SECOND} flex-1 lg:flex-none`}>
          <Icon n="ban" c="size-4" />
          Won&apos;t do
          <Kbd k="W" />
        </button>
        <button onClick={() => on.decide(n, 'open')} className={`${PRIMARY_BASE} ${NEED.approve.btn} flex-[1.4] lg:flex-none`}>
          <Icon n="thumb" c="size-4.5" />
          Approve
          <Kbd k="A" />
        </button>
      </>,
    )
  if (it.status === 'review')
    return card(
      'done',
      `${name} finished this`,
      m ? text(m) : null,
      <>
        <button onClick={() => on.notYet(n)} className={`${SECOND} flex-1 lg:flex-none`}>
          <Icon n="reopen" c="size-4" />
          Not yet
          <Kbd k="N" />
        </button>
        <button onClick={() => on.decide(n, 'done')} className={`${PRIMARY_BASE} ${NEED.accept.btn} flex-[1.4] lg:flex-none`}>
          <Icon n="check" c="size-4.5" sw="2.25" />
          Accept
          <Kbd k="A" />
        </button>
      </>,
    )
  return null
}

/** An answered question, in the card it was asked in, its layout as it was (r1003): your picks ticked, Send answer
 * where it was said as Sent (Replied when you wrote instead), greyed and not to be clicked, and Edit (under the
 * pointer on the desktop) to pick again (r1007). */
export function Answered({ it, x, done, env, on, reasking, going = '' }: {
  it: Item
  x: Message
  done: readonly string[]
  env: TalkEnv
  on: CardEvents
  /** being answered again: a form again */
  reasking: boolean
  /** an answer on its way: where it is */
  going?: string
}) {
  const last = answeredLast(it) && lastAgentMessage(it)?.id === x.id
  if (reasking)
    return (
      <NeedFrame
        icon="ask"
        title={`${msgName(x)} asks you`}
        t={x.t}
        now={env.now}
        // Cancel in the head, as when a decision is changed: the buttons keep one line on the phone
        act={
          <button onClick={on.cancelReask} className={MODIFY_LINK.replace(/lg:opacity-0\S*|lg:group-hover\S*/g, '')}>
            Cancel
          </button>
        }
        body={<Rich text={x.text} world={env.world} cls="text-zinc-900 dark:text-zinc-100" choosing={env.choosing} onRef={on.ref} onPicture={on.picture} />}
        foot={
          <>
            {last ? <KeepBtn it={it} on={on} /> : null}
            <SendAnswerBtn n={it.n} picked={!!env.choosing?.picked.size} cls="flex-[1.4] lg:flex-none" keyHint on={on} />
          </>
        }
      />
    )
  return (
    <NeedFrame
      icon="ask"
      title={`${msgName(x)} asks you`}
      t={x.t}
      now={env.now}
      going={going}
      done
      act={
        <button onClick={() => on.reask(it.n, x.id)} className={MODIFY_LINK}>
          Edit
        </button>
      }
      body={<Rich text={x.text} world={env.world} cls="text-zinc-600 dark:text-zinc-300" done={done} onRef={on.ref} onPicture={on.picture} />}
      foot={
        <>
          {last ? <KeepBtn it={it} on={on} /> : null}
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
            <button disabled aria-pressed className={`${DECIDED_ON(CHOSEN_TONE.Answer)} flex-[1.4] lg:flex-none`}>
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
