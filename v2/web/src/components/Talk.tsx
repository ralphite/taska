// A conversation on an item: your words on the right in blue, an agent's on the left in a card under its name, the
// organizer's notes, documents' comments in time (T274 #4), files and voice notes. The same on the item page and the card.
import type { IconName } from '../lib/icons'
import type { ReactNode } from 'react'
import {
  ACT_ICON,
  DC_BTN,
  DONE_OTHER_BTN,
  DONE_PICK,
  HIT,
  KIND,
  MODIFY_LINK,
  NEED,
  NEEDS_CARD,
  NEEDS_PILL,
  PRIMARY_BASE,
  SECOND,
} from '../lib/constants'
import {
  U,
  answerOf,
  lastAgentMsg,
  byN,
  byR,
  ctx,
  desk,
  docById,
  docsOf,
  oneLine,
  plural,
  rcode,
  userWord,
  when,
  whoName,
  msgName,
  arrived,
  code,
  outboxLine,
  outboxState,
  answerGoing,
  useArea,
  type Job,
} from '../lib/state'
import type { Comment, Doc, FileRef, Input, Item, Msg } from '../lib/types'
import { clean, groups, hasChoices, mdHtml, plainQuote } from '../lib/markdown'
import { audioOf } from '../lib/audio'
import { ticksNotSent } from '../lib/doctick'
import { P_CACHE } from '../lib/settings'
import { Avatar, Icon, Kbd } from './ui'
import { clock } from '../lib/state'

const isAudio = (f: FileRef) => (f.mime || '').startsWith('audio/')
const isImage = (f: FileRef) => (f.mime || '').startsWith('image/')
const fileUrl = (f: string) => `${ctx.P}f/${encodeURIComponent(f)}`

/** Markdown as the page shows it everywhere (markdown.ts); choices in item `form`'s open question can be tapped. */
export function Rich({
  text,
  gid = '',
  cls = '',
  form = 0,
  done = null,
}: {
  text: string
  gid?: string
  cls?: string
  form?: number
  done?: string[] | null
}) {
  return (
    <div
      className={`space-y-2 break-words [&_p]:leading-relaxed ${cls}`}
      dangerouslySetInnerHTML={{ __html: clean(mdHtml(text, gid, form, done)) }}
    />
  )
}

function PlayIcon({ src, cls }: { src: string; cls: string }) {
  return <Icon n={audioOf(src).playing ? 'pausefill' : 'play'} c={cls} />
}
/** B361: a voice note's length, from its name (voice_1-05.webm is 1:05), in ms; null when its name does not say. */
export const voiceLen = (f: FileRef) => {
  const m = /(\d+)-(\d+)\.\w+$/.exec(f.name || '')
  return m ? (60 * +m[1] + +m[2]) * 1000 : null
}
// B361: what a voice note shows is what tells you something: how long it is, and while it plays, how far it got
function VoiceTime({ src, total }: { src: string; total: number | null }) {
  const { playing, t } = audioOf(src)
  if (t !== null && (playing || (total !== null && t < total - 500)))
    return (
      <>
        {clock(t)}
        {total !== null ? <span className="text-zinc-400 dark:text-zinc-500"> / {clock(total)}</span> : null}
      </>
    )
  return <>{total !== null ? clock(total) : t !== null ? clock(t) : 'Play'}</>
}
// F364: pointing at a voice note floats this bar above it, as a selection does; its padding below bridges to the note.
// T529: `beside`, under your words: to the note's left, in the line's empty room, so it covers none of your words
function WordsBar({ f, beside = false }: { f: string; beside?: boolean }) {
  return (
    <span
      className={`absolute z-20 hidden lg:group-focus-within/voice:block lg:group-hover/voice:block ${beside ? 'top-0 right-full pr-1.5' : 'bottom-full left-0 pb-1.5'}`}
    >
      <span className="flex rounded-full bg-zinc-900 p-1 shadow-lg ring-1 ring-black/10 dark:bg-zinc-100 dark:ring-white/10">
        <button
          data-act="as-said"
          data-f={f}
          className="flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"
        >
          <Icon n="quote" c="size-4" />
          Original words
        </button>
      </span>
    </span>
  )
}
export function Thumbs({ files, gid, size = 'size-20' }: { files: FileRef[]; gid: string; size?: string }) {
  groups.set(
    gid,
    files.filter(isImage).map((f) => f.f),
  )
  const tidy = P_CACHE.prefs?.tidy !== false
  return (
    <>
      {files.map((f) => {
        if (isAudio(f)) {
          const src = fileUrl(f.f)
          return (
            // F364: one chip: play and the length. Pointing at it floats a small bar above it, as a selection does,
            // with the original words; the phone, with no pointing, has them as an icon at the chip's end
            <span
              key={f.f}
              className="group/voice relative flex h-9 shrink-0 items-center self-end rounded-full border border-zinc-200 pl-1 text-[13px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              <button
                data-act="play"
                data-src={src}
                aria-label={`Play the voice note${voiceLen(f) ? `, ${clock(voiceLen(f) as number)}` : ''}`}
                className={`${HIT} flex h-full items-center gap-2 rounded-full pr-3 hover:text-zinc-900 dark:hover:text-white`}
              >
                <span
                  data-icon
                  className="grid size-7 place-items-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  <PlayIcon src={src} cls="size-3.5" />
                </span>
                <span data-time className="font-mono tabular-nums">
                  <VoiceTime src={src} total={voiceLen(f)} />
                </span>
              </button>
              {tidy ? (
                <>
                  <button
                    data-act="as-said"
                    data-f={f.f}
                    aria-label="Original words"
                    className="mr-1 -ml-1.5 grid size-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 lg:hidden dark:text-zinc-500 dark:hover:bg-zinc-800"
                  >
                    <Icon n="quote" c="size-4" />
                  </button>
                  <WordsBar f={f.f} />
                </>
              ) : null}
            </span>
          )
        }
        if (isImage(f))
          return (
            <button
              key={f.f}
              data-act="view"
              data-g={gid}
              data-f={f.f}
              title={f.name}
              className={`${size} shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 hover:brightness-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:brightness-110`}
            >
              <img src={fileUrl(f.f)} alt={f.name} loading="lazy" className="size-full object-contain" />
            </button>
          )
        return (
          <a
            key={f.f}
            href={fileUrl(f.f)}
            target="_blank"
            rel="noopener"
            className="flex h-11 max-w-56 shrink-0 items-center gap-1.5 self-end rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Icon n="file" c="size-4" />
            <span className="truncate">{f.name}</span>
          </a>
        )
      })}
    </>
  )
}
// T230 #1: pictures and files in one row you can slide, voice notes in a row of their own below
export function FileRows({
  files,
  gid,
  size,
  cls = '',
}: {
  files: FileRef[]
  gid: string
  size?: string
  cls?: string
}) {
  const audio = files.filter(isAudio),
    rest = files.filter((f) => !isAudio(f))
  return (
    <div className={`${cls} flex flex-col gap-2`}>
      {rest.length ? (
        <div
          className={`flex items-end gap-2 overflow-x-auto lg:scrollbar-thin ${rest.length > 3 ? '[mask-image:linear-gradient(to_right,black_85%,transparent)]' : ''}`}
        >
          <Thumbs files={rest} gid={gid} size={size} />
        </div>
      ) : null}
      {audio.length ? (
        <div className="flex flex-wrap gap-2">
          <Thumbs files={audio} gid={gid + 'a'} size={size} />
        </div>
      ) : null}
    </div>
  )
}
// T274 #40: your voice note under your words is one small line: play, its length, the original words
export function VoiceLine({
  files,
  bare = false,
  beside = false,
}: {
  files?: FileRef[]
  bare?: boolean
  beside?: boolean
}) {
  const audio = (files || []).filter(isAudio)
  const tidy = !bare && P_CACHE.prefs?.tidy !== false // bare: Original words is in the message's ⋯ (B321)
  return (
    <>
      {audio.map((f) => {
        const src = fileUrl(f.f)
        return (
          <span
            key={f.f}
            className="group/voice relative flex items-center gap-1 px-1 text-[11px] text-zinc-400 dark:text-zinc-500"
          >
            <button
              data-act="play"
              data-src={src}
              aria-label={`Play ${f.name}`}
              className={`${HIT} flex h-7 items-center gap-1 rounded-full px-1.5 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
            >
              <span data-icon>
                <PlayIcon src={src} cls="size-3.5" />
              </span>
              <span data-time className="font-mono tabular-nums">
                <VoiceTime src={src} total={voiceLen(f)} />
              </span>
            </button>
            {tidy ? (
              <>
                <span className="lg:hidden">·</span>
                <button
                  data-act="as-said"
                  data-f={f.f}
                  className={`${HIT} h-7 rounded-lg px-1 font-medium hover:bg-zinc-100 hover:text-zinc-700 lg:hidden dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
                >
                  Original words
                </button>
                <WordsBar f={f.f} beside={beside} />
              </>
            ) : null}
          </span>
        )
      })}
    </>
  )
}
/** F428 (P0): a card that asks you, the same frame before and after you answer: amber while it waits for you, grey
 * once answered, with nothing moving. */
export function NeedFrame({
  icon,
  title,
  t,
  done = false,
  body,
  foot,
  hint = '',
  going = '',
  act = null,
}: {
  icon: IconName
  title: string
  going?: string
  act?: ReactNode
  t?: string
  done?: boolean
  body: ReactNode
  foot: ReactNode
  hint?: string
}) {
  return (
    <section
      className={`w-full rounded-2xl border ${done ? 'group/form border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900' : NEEDS_CARD}`}
    >
      <div className="flex items-center gap-2.5 px-4 pt-3.5 lg:px-5 lg:pt-4">
        <Icon
          n={icon}
          c={`size-5 ${done ? 'text-zinc-400 dark:text-zinc-500' : 'text-amber-600 dark:text-amber-400'}`}
        />
        <p
          className={`min-w-0 flex-1 text-sm font-semibold lg:text-[15px] ${done ? 'text-zinc-600 dark:text-zinc-300' : 'text-amber-900 dark:text-amber-200'}`}
        >
          {title}
        </p>
        {
          act /* T438 #3: Modify sits up here, so the two buttons below keep their place (on the phone, where the time was) */
        }
        {going ? (
          // T438 #1: an answer on its way says so where the time goes, until Taska has it
          <span className="animate-pulse text-xs text-blue-600 dark:text-blue-400">{going}</span>
        ) : t ? (
          <span
            className={`text-xs ${act ? 'hidden lg:inline' : ''} ${done ? 'text-zinc-400 dark:text-zinc-500' : 'text-amber-700/80 dark:text-amber-300/70'}`}
          >
            {when(t)}
          </span>
        ) : null}
      </div>
      {body ? (
        <div className="space-y-2 px-4 pt-2 text-[15px] leading-relaxed text-zinc-800 lg:px-5 lg:pl-12 dark:text-zinc-200">
          {body}
        </div>
      ) : null}
      {foot ? (
        <div className="flex min-h-[4.25rem] items-center gap-2.5 p-3 pt-3.5 lg:justify-end lg:px-5 lg:pb-4">
          {hint ? (
            <p className="mr-auto hidden text-xs text-amber-700/80 xl:block dark:text-amber-300/70">{hint}</p>
          ) : null}
          {foot}
        </div>
      ) : hint ? (
        <p className="px-4 pt-2 pb-3.5 text-xs text-amber-700/80 lg:px-5 lg:pl-12 dark:text-amber-300/70">{hint}</p>
      ) : (
        <div className="h-3.5" />
      )}
    </section>
  )
}
// What you chose on a proposal or finished work, in the words of its button
const chosen = (d: NonNullable<Item['decided']>) =>
  d.from === 'proposed' ? (d.to === 'dropped' ? "Won't do" : 'Approve') : d.to === 'done' ? 'Accept' : 'Not yet'
// F427, F428: Approve or Accept as well as answering; inside the question's card, answered or not
export const KeepBtn = ({ it, quiet = false }: { it: Item; quiet?: boolean }) =>
  it.decided &&
  it.status !== it.decided.from &&
  (lastAgentMsg(it)?.id ?? null) === it.decided.msg &&
  (it.decided.from === 'proposed' || it.decided.from === 'review') ? (
    // T438 #5: decided: the button stays where it was, saying what you chose, with that choice's own icon (T529)
    <span className={`${DONE_PICK} font-medium`}>
      <Icon n={ACT_ICON[chosen(it.decided)]} c="size-4" sw="2.25" />
      {chosen(it.decided)}
    </span>
  ) : it.status === 'proposed' ? (
    // B485 (quiet): you answered or replied instead: what you did stands out, Approve waits quietly beside it
    <button data-act="status" data-n={it.n} data-v="open" className={quiet ? DONE_OTHER_BTN : SECOND}>
      <Icon n="thumb" c="size-4" />
      Approve
    </button>
  ) : it.status === 'review' ? (
    <button data-act="status" data-n={it.n} data-v="done" className={quiet ? DONE_OTHER_BTN : SECOND}>
      <Icon n="check" c="size-4" sw="2.25" />
      Accept
    </button>
  ) : null
/** F428: the item's latest word from an agent is a question you answered: its card holds the item's Approve/Accept. */
export const answeredLast = (it: Item) => {
  const x = lastAgentMsg(it)
  return !!x && x.kind === 'ask' && hasChoices(x.text) && !!answerOf(it.thread, x, it.n)?.length
}
export const SendAnswerBtn = ({
  n,
  cls = 'w-full',
  keyHint = false,
}: {
  n: number
  cls?: string
  keyHint?: boolean
}) => (
  <button
    data-act="choice-send"
    data-n={n}
    disabled={!(U.choice?.n === n && U.choice.picked.size)}
    className={`${PRIMARY_BASE} ${NEED.answer.btn} ${cls}`}
  >
    Send answer
    {keyHint ? <Kbd k="⌘↵" /> : null}
  </button>
)
const KindTag = ({ x }: { x: Msg }) =>
  KIND[x.kind || ''] ? (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${x.kind === 'decide' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}
    >
      {KIND[x.kind || '']}
    </span>
  ) : null

// A long agent message shows its first line, the conclusion, until you ask for more (T58 #5); on the desktop it
// shows whole up to a height, a fade says there is more (F93, T274 #15).
export function MsgText({
  x,
  gid,
  form = 0,
  done = null,
  whole = false,
}: {
  x: Msg
  gid: string
  form?: number
  done?: string[] | null
  whole?: boolean
}) {
  // B360: the latest message of the item you opened (and the card that shows it) is open: it is what you came to read;
  // only past 50 lines is it cut
  const it = U.open ? byN.get(U.open) : undefined,
    latest = whole || it?.thread.filter((m) => m.by !== 'org').at(-1)?.id === x.id
  const lines = x.text.trim().split('\n').length
  const long =
    (x.by !== 'you' || desk()) && x.kind !== 'ask' && (latest ? lines > 50 : x.text.length > 240 || lines > 3)
  const open = U.moreMsgs.has(x.id)
  if (long && desk() && !open)
    return (
      <>
        <div
          data-clip
          data-act="more-msg"
          data-expand
          data-id={x.id}
          className="max-h-48 cursor-pointer overflow-hidden mask-b-from-60%"
        >
          <Rich text={x.text} gid={gid + 'md' + x.id} form={form} done={done} />
        </div>
        <button
          data-act="more-msg"
          data-id={x.id}
          className="-mb-2 flex h-9 items-center text-sm font-medium text-blue-600 dark:text-blue-400"
        >
          Show all
        </button>
      </>
    )
  const folded = long && !desk() && !open
  const body = (
    <Rich text={folded ? x.text.trim().split('\n')[0] : x.text} gid={gid + 'md' + x.id} form={form} done={done} />
  )
  if (!long) return body
  return (
    <>
      <div data-act="more-msg" data-expand data-id={x.id} className="cursor-pointer">
        {body}
      </div>
      <button
        data-act="more-msg"
        data-id={x.id}
        className="-mb-2 flex h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400"
      >
        {folded ? 'Show more' : 'Show less'}
      </button>
    </>
  )
}
// T472 (D49): a question that sends you to a document's choices, answered by a reply with nothing picked there
const pickInDoc = (x: Msg) =>
  x.kind === 'ask' &&
  [...x.text.matchAll(/\bD(\d+)\b/g)].some(([, n]) => {
    const md = docById(Number(n))?.md || ''
    return /^\s*[-*+]\s+[([][ ]?[)\]]\s+/m.test(md) && !/^\s*[-*+]\s+[([][xX][)\]]/m.test(md)
  })
// B452: what the organizer wrote from something you said says where it comes from; your whole words open from there
function FromInput({ rid }: { rid: string }) {
  const r = byR.get(rid),
    on = r?.scope && r.scope !== U.open ? code(r.scope) : ''
  return (
    <span className="-ml-1 text-xs text-zinc-500 dark:text-zinc-400">
      · from{' '}
      <button data-act="go-input" data-id={rid} className="font-mono text-blue-600 hover:underline dark:text-blue-400">
        {rcode(rid)}
      </button>
      {on ? ` on ${on}` : ''}
    </span>
  )
}
// F327, F428 (P0): an answered question stays where it was, in the same card: grey now, your picks ticked, the others
// quieter, Submitted where its buttons were, and Modify (on hover on the desktop) to pick again
function Answered({ x, gid, done }: { x: Msg; gid: string; done: string[] }) {
  useArea('feedback') // T438 #1: an answer on its way says where it is
  const n = U.open || 0,
    it = byN.get(n)
  if (U.reask === x.id && n)
    return (
      <NeedFrame
        icon="ask"
        title={`${msgName(x)} asks you`}
        t={x.t}
        body={<Rich text={x.text} gid={gid + 'rq' + x.id} cls="text-zinc-900 dark:text-zinc-100" form={n} />}
        foot={
          <>
            <button data-act="ask-modify-cancel" className={`${SECOND} flex-1 lg:flex-none`}>
              Cancel
            </button>
            {it && answeredLast(it) && lastAgentMsg(it)?.id === x.id ? <KeepBtn it={it} /> : null}
            <SendAnswerBtn n={n} cls="flex-[1.4] lg:flex-none" />
          </>
        }
      />
    )
  const g = n && it?.thread.filter((m) => m.kind === 'ask').at(-1)?.id === x.id ? answerGoing(n) : undefined
  return (
    <NeedFrame
      icon="ask"
      title={`${msgName(x)} asks you`}
      t={x.t}
      going={g ? outboxState(g) : ''}
      done
      act={
        <button data-act="ask-modify" data-id={x.id} data-n={n} className={MODIFY_LINK}>
          {done.length ? 'Modify' : 'Answer'}
        </button>
      }
      body={<Rich text={x.text} gid={gid + 'q' + x.id} cls="text-zinc-600 dark:text-zinc-300" done={done} />}
      foot={
        <>
          {/* F428, R369 review: the buttons stay where they were; Send answer is now the grey Submitted */}
          {it && answeredLast(it) && lastAgentMsg(it)?.id === x.id ? <KeepBtn it={it} quiet /> : null}
          {/* B485: replying instead of picking is what you did: it stands out as a pick does */}
          <span className={`${DONE_PICK} flex-[1.4] font-semibold lg:flex-none`}>
            <Icon n={done.length ? 'check' : 'reply'} c="size-4" sw="2.25" />
            {done.length ? 'Submitted' : 'Skipped · you replied'}
            <span className="invisible">
              <Kbd k="⌘↵" />
            </span>
          </span>
        </>
      }
    />
  )
}
interface Version {
  old: boolean
  text: string
  label: string
}
// An input you edited or added details to shows once, as it is now (B157, A24)
function versions(thread: Msg[]) {
  const by = new Map<string, Msg[]>(),
    out = new Map<number, Version>(),
    plain = (t: string) => t.replace(/^r\d+ updated:\n/, '')
  for (const x of thread)
    if (x.by === 'you' && x.src && !x.change) {
      if (!by.has(x.src)) by.set(x.src, [])
      by.get(x.src)?.push(x)
    } // S1: a note on an edit is not a version
  for (const list of by.values())
    if (list.length > 1) {
      const info = list.map((x, i) => {
        const text = plain(x.text),
          prev = i ? plain(list[i - 1].text) : null
        const added =
          prev !== null && text.startsWith(prev) && text.length > prev.length ? text.slice(prev.length).trim() : null
        return {
          x,
          text: added ?? text,
          label: !i ? '' : added !== null ? 'added details' : 'edited',
          edit: !!i && added === null,
        }
      })
      info.forEach((v, i) =>
        out.set(v.x.id, { old: info.slice(i + 1).some((w) => w.edit), text: v.text, label: v.label }),
      )
    }
  return out
}
const voiceAttr = (r: Input | null | undefined) => (r?.files?.some(isAudio) ? { 'data-voice': r.id } : {}) // F144: words selected here can be corrected

interface ReadBy {
  id: number
  names: string[]
  t: number
}
const YOU_BUBBLE =
  'max-w-[85%] rounded-2xl rounded-tr-md bg-blue-600 px-4 py-2.5 text-[15px] leading-relaxed text-white dark:bg-blue-500 [&_[data-ref]]:text-white [&_[data-ref]]:underline [&_[data-ref]]:decoration-white/60 [&_[data-ref]]:underline-offset-2 [&_a]:text-white [&_a]:decoration-white/60 [&_blockquote]:border-white/50 [&_blockquote]:text-white/85 [&_button[data-act=more-msg]]:text-white [&_code]:bg-white/15 [&_code]:text-white [&_mark]:text-zinc-900 [&_pre]:bg-white/15 [&_pre]:text-white'
// B440: taking back what you just sent sits on its own line (it was on a line over the box)
const TakeBack = ({ job }: { job: Job | undefined }) =>
  job?.undo && !job.undo.entry?.done ? (
    <button data-act="unsend" data-q={job.q} className={DC_BTN}>
      Undo
    </button>
  ) : null
// B440: what you sent to this item is in the thread at once, saying where it is, until Taska has it
function Pending({ n }: { n: number }) {
  useArea('feedback')
  useArea('composer')
  const jobs = U.outbox.filter(
    (q) => !q.unsent && !arrived(q) && q.scope === code(n) && !(q.kind === 'answer' && !q.files.length), // a form's ticks show on its card (T274 #27)
  )
  return (
    <>
      {jobs.map((q) => {
        const bad = q.failed && !q.net
        return (
          <div key={q.q} data-q={q.q} className="flex flex-col items-end gap-1">
            <div className={`${YOU_BUBBLE} break-words whitespace-pre-wrap ${bad ? 'opacity-70' : ''}`}>
              {q.text || outboxLine(q)}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-1">
              <span className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                You ·{' '}
                <span
                  className={bad ? 'text-red-600 dark:text-red-400' : 'animate-pulse text-blue-600 dark:text-blue-400'}
                >
                  {outboxState(q)}
                </span>
              </span>
              {bad ? (
                <>
                  <button data-act="outbox-retry" className={DC_BTN}>
                    Retry
                  </button>
                  <button data-act="outbox-edit" className={DC_BTN}>
                    Edit
                  </button>
                </>
              ) : (
                <TakeBack job={q} />
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
export function MsgView({
  x,
  gid,
  form = 0,
  done = null,
  ver,
  withdrawn = false,
  read = null,
}: {
  x: Msg
  gid: string
  form?: number
  done?: string[] | null
  ver?: Version
  withdrawn?: boolean
  read?: ReadBy | null
}) {
  const you = x.by === 'you',
    src = you && x.src ? byR.get(x.src) : null,
    y = ver ? { ...x, text: ver.text } : x
  const strip = (files: FileRef[] | undefined, g: string, size?: string) =>
    files?.length ? (
      <FileRows files={files} gid={g} size={size} cls={you ? 'items-end max-w-full [&>div]:max-w-full' : 'mt-3'} />
    ) : null
  if (
    you &&
    y.text &&
    y.text
      .trim()
      .split('\n')
      .every((l) => /^\s*✓/.test(l)) &&
    !src?.files?.length
  )
    return null // T274 #27
  if (you)
    return (
      <div
        {...(x.src ? { 'data-src': x.src } : {})}
        className={`group flex scroll-mb-4 flex-col items-end gap-1 rounded-2xl transition-colors duration-700 ${ver?.old ? 'opacity-60' : ''}`}
      >
        {y.text ? (
          <div {...voiceAttr(src)} className={YOU_BUBBLE}>
            {ver?.old ? (
              <div className="line-clamp-2">
                <MsgText x={y} gid={gid} />
              </div>
            ) : (
              <MsgText x={y} gid={gid} />
            )}
          </div>
        ) : null}
        {ver?.old ? null : (
          <>
            {strip(
              src?.files?.filter((f) => !isAudio(f)),
              gid + 't' + x.id,
            )}
          </>
        )}
        {/* B321: one line under what you wrote: the voice note, who and when, and ⋯ with Edit, Add more and the rest */}
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          {ver?.old ? null : <VoiceLine files={src?.files} bare={!!src && !src.moved && !src.deleted} beside />}
          <span className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            You · {ver?.old ? 'earlier version · ' : ver?.label ? ver.label + ' · ' : ''}
            {when(x.t)}
            {x.edited && !ver?.old ? (
              <>
                {' · '}
                {src?.history?.length ? (
                  <button
                    data-act="input-history"
                    data-id={src.id}
                    className="relative underline decoration-dotted underline-offset-2 after:absolute after:-inset-3 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    edited {when(x.edited)}
                  </button>
                ) : (
                  `edited ${when(x.edited)}`
                )}
              </>
            ) : null}
            {src?.tr_wait ? (
              <>
                {' · '}
                <span className="animate-pulse text-blue-600 dark:text-blue-400">transcribing the voice note…</span>
              </>
            ) : null}
            {read ? (
              <>
                {' · '}
                <span
                  title={`${read.names.join(', ')} read it ${when(new Date(read.t).toISOString())}`}
                  className="inline-flex items-center gap-0.5 font-medium text-zinc-500 dark:text-zinc-400"
                >
                  <Icon n="check" c="size-3" sw="2.5" />
                  Read by {read.names.join(', ')}
                </span>
              </>
            ) : null}
          </span>
          {src && !ver?.old ? <TakeBack job={U.sentJobs.find((j) => j.rid === src.id)} /> : null}
          {src && !ver?.old && !src.moved && !src.deleted ? (
            <button
              data-act="input-more"
              data-id={src.id}
              aria-label={`More for ${rcode(src.id)}`}
              className={`${DC_BTN} min-w-11 justify-center`}
            >
              <Icon n="more" c="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    )
  if (x.kind === 'withdraw')
    return (
      <div className="flex items-start gap-2 px-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
        <Icon n="undo" c="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">{whoName(x.by)} took back its question</span>{' '}
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{when(x.t)}</span>
          {x.text.trim() ? <Rich text={x.text} gid={gid + 'w' + x.id} cls="mt-0.5" /> : null}
        </div>
      </div>
    ) // F220: a line, not a message
  if (withdrawn)
    return (
      <div className="flex flex-col items-start gap-1.5 opacity-60">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] whitespace-nowrap text-zinc-400 dark:text-zinc-500">
          <Avatar by={x.by} />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{whoName(x.by)}</span>
          {x.ses ? <span className="-ml-1 text-xs text-zinc-500 dark:text-zinc-400">· {x.ses}</span> : null}
          {x.to?.length ? <span className="text-xs text-zinc-500 dark:text-zinc-400">→ {x.to.join(', ')}</span> : null}
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
            Withdrawn
          </span>
          <span>{when(x.t)}</span>
        </div>
        <div className="w-full rounded-2xl rounded-tl-md border border-dashed border-zinc-300 px-4 py-3 text-[15px] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <div className="line-clamp-2 line-through decoration-zinc-400 dark:decoration-zinc-500">
            {oneLine(x.text)}
          </div>
        </div>
      </div>
    )
  if (x.hidden && !form && !U.showHidden.has(x.id))
    return (
      <button
        data-act="msg-peek"
        data-id={x.id}
        className="flex items-center gap-1.5 self-start px-1 text-[12px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        {whoName(x.by)} · hidden message · {when(x.t)} · Show
      </button>
    ) // T257 #12
  // F428 (P0): an answered question is its own card, the one it was asked in, not a message under a header
  // B471: answered by writing, nothing picked: the same card, Skipped
  if (!form && done && hasChoices(x.text) && x.kind === 'ask') return <Answered x={x} gid={gid} done={done} />
  const card = form
    ? 'space-y-2.5 border-amber-200 bg-amber-50 p-3 text-zinc-900 dark:border-amber-400/25 dark:bg-amber-400/7 dark:text-zinc-100'
    : 'border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
  return (
    <div className="group/msg flex flex-col items-start gap-1.5">
      {/* T529: on a narrow screen the header wraps between its parts, never inside one */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] whitespace-nowrap text-zinc-400 dark:text-zinc-500">
        <Avatar by={x.by} />
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{whoName(x.by)}</span>
        {x.ses ? <span className="-ml-1 text-xs text-zinc-500 dark:text-zinc-400">· {x.ses}</span> : null}
        {x.to?.length ? <span className="text-xs text-zinc-500 dark:text-zinc-400">→ {x.to.join(', ')}</span> : null}
        {x.by === 'org' && x.src ? <FromInput rid={x.src} /> : null}
        {done && !form ? (
          <span className="flex items-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-300">
            <Icon n={pickInDoc(x) ? 'reply' : 'check'} c="size-3" sw="3" />
            {pickInDoc(x) ? 'Skipped' : 'Submitted'}
          </span>
        ) : (
          <KindTag x={x} />
        )}
        {/* the time and the message's More go together, so More is never alone on a line */}
        <span className="flex items-center gap-2">
          {when(x.t)}
          {form || !U.open ? null : x.hidden ? (
            <button data-act="msg-hide" data-n={U.open} data-id={x.id} data-on={0} className={DC_BTN}>
              Show again
            </button>
          ) : (
            <button
              data-act="msg-menu"
              data-n={U.open}
              data-id={x.id}
              aria-label="More for this message"
              className={`${DC_BTN} min-w-9 justify-center lg:opacity-0 lg:group-hover/msg:opacity-100 lg:focus-visible:opacity-100`}
            >
              <Icon n="more" c="size-3.5" />
            </button>
          )}
        </span>
      </div>
      <div className={`w-full rounded-2xl rounded-tl-md border text-[15px] leading-relaxed ${card}`}>
        {form ? (
          <>
            <div className="px-1">
              <MsgText x={x} gid={gid} form={form} />
            </div>
            {hasChoices(x.text) ? <SendAnswerBtn n={form} /> : null}
          </>
        ) : (
          <MsgText x={x} gid={gid} done={done} />
        )}
        {strip(x.files, gid + 'm' + x.id, 'h-48 w-24')}
      </div>
    </div>
  )
}
// T274 #4: a comment on one of the item's documents shows among its messages, in time
export interface Note {
  t: string
  node: ReactNode
}
export function docNotes(n: number, from = ''): Note[] {
  return docsOf(n)
    .flatMap((d) => [
      ...d.blocks.flatMap((b) => b.comments.map((c) => ({ c, d, key: b.key }))),
      ...(d.whole || []).map((c) => ({ c, d, key: 'doc' })),
      ...d.detached.flatMap((t) => t.comments.map((c) => ({ c, d, key: t.key, changed: true }))),
    ])
    .filter(({ c }) => c.t && (!from || c.t >= from))
    .sort((a, b) => a.c.t.localeCompare(b.c.t))
    .map(({ c, d, key, changed }: { c: Comment; d: Doc; key: string; changed?: boolean }) => {
      const you = c.by === 'you',
        // D80 #14: the words it is about were changed in the document since: the quote struck through, and said, as the
        // document says it of them (the phone's own list of such comments)
        gone = changed ? <span className="shrink-0">· Original text changed</span> : null,
        // T529: its padding only gives the pointer's background room; the words sit as far apart as the line's others
        where = (
          <button
            data-act="doc-at"
            data-d={d.d}
            data-key={key}
            className="-mx-1 rounded px-1 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            on <span className="font-mono">D{d.d}</span>
          </button>
        ),
        // B477: what the comment is about is part of the message, at its top, as a quote (it opens that place)
        quote = c.quote ? (
          <button
            data-act="doc-at"
            data-d={d.d}
            data-key={key}
            className={`mb-1.5 line-clamp-3 block w-full border-l-2 pl-2 text-left text-[13px] leading-snug ${changed ? 'line-through' : ''} ${
              you
                ? 'border-white/50 text-white/85'
                : 'border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400'
            }`}
          >
            “{plainQuote(c.quote)}”
          </button>
        ) : null,
        words = c.text.trim() ? (
          <Rich text={c.text} gid={`dn${d.d}-${c.id}`} />
        ) : // B15 (T422): a voice note with no words yet still says what it is
        c.files?.some(isAudio) ? (
          'Voice note'
        ) : (
          plural(c.files?.length || 0, 'file')
        )
      // B436: a comment on a document is what you (or an agent) said, so it looks like what you said: your words in
      // your bubble, theirs as their message; the line under it says where in the document it is
      return {
        t: c.t,
        node: you ? (
          <div key={`dn${d.d}-${c.id}`} className="flex flex-col items-end gap-1">
            <div className={YOU_BUBBLE}>
              {quote}
              {words}
            </div>
            <div className="flex max-w-full flex-wrap items-center justify-end gap-x-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              <VoiceLine files={c.files} bare />
              <span className="flex max-w-full min-w-0 items-center gap-0.5 px-1">
                <Icon n="comment" c="size-3 shrink-0" />
                <span className="min-w-0 truncate">
                  You · {where} · {when(c.t)} {gone}
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
              <span className="shrink-0">{when(c.t)}</span>
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
/** A document as a card: its title, code, comments and time; it opens in Taska (I289). B524 (r736): choices ticked in
 * it and not sent are said on it too, so they are not forgotten. */
export const DocCard = ({ d, cls = '' }: { d: Doc; cls?: string }) => {
  const waiting = ticksNotSent(d)
  return (
    <button
      data-act="doc-open"
      data-d={d.d}
      className={`flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${cls}`}
    >
      <Icon n={d.fmt === 'html' ? 'web' : 'doc'} c="size-5 text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{d.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="min-w-0 truncate">
            D{d.d} · {plural(d.comments.length, 'comment')} · {when(d.t1)}
          </span>
          {waiting ? <span className={`${NEEDS_PILL} -my-0.5`}>{waiting}</span> : null}
        </span>
      </span>
      <Icon n="right" c="size-4 text-zinc-300 dark:text-zinc-600" />
    </button>
  )
}
export function Talk({
  it,
  list,
  gid = '',
  notes = [],
  card,
}: {
  it: Item
  list: Msg[]
  gid?: string
  notes?: Note[]
  card?: { id: number; node: ReactNode } // T438 #12: the card of what waits on you, drawn where its message is
}) {
  const th = it.thread,
    vers = versions(th),
    gone = new Set<number>()
  th.forEach((x, i) => {
    // a withdraw takes back the open question or block before it (nothing of yours in between)
    const q =
      x.kind === 'withdraw' &&
      th
        .slice(0, i)
        .reverse()
        .find((y) => y.kind === 'ask' || y.kind === 'block' || userWord(y))
    if (q && !userWord(q)) gone.add(q.id)
  })
  const mine = th.findLastIndex((x) => x.by === 'you'),
    theirs = th.findLastIndex((x) => x.by !== 'you' && x.by !== 'org'),
    t = mine >= 0 ? Date.parse(th[mine].t) : 0
  const readers =
    mine > theirs && it.read
      ? Object.entries(it.read)
          .filter(([, ms]) => ms >= t)
          .sort((a, b) => b[1] - a[1])
      : [] // no answer yet, but read after your words
  const read = readers.length ? { id: th[mine].id, names: readers.map(([n]) => whoName(n)), t: readers[0][1] } : null
  let k = 0
  const out: ReactNode[] = []
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
        x={x}
        gid={gid}
        done={gone.has(x.id) ? null : answerOf(th, x, it.n)}
        ver={vers.get(x.id)}
        withdrawn={gone.has(x.id)}
        read={read?.id === x.id ? read : null}
      />,
    )
  }
  before('')
  out.push(<Pending key="pending" n={it.n} />)
  return <>{out}</>
}
