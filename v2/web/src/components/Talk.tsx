// A conversation on an item: your words on the right in blue, an agent's on the left in a card under its name, the
// organizer's notes, documents' comments in time (T274 #4), files and voice notes. The same on the item page and the card.
import type { ReactNode } from 'react'
import { DC_BTN, HIT, KIND, NEED, PRIMARY_BASE } from '../lib/constants'
import { U, byN, byR, ctx, desk, docsOf, oneLine, plural, rcode, userWord, when, whoName } from '../lib/state'
import type { Doc, FileRef, Input, Item, Msg } from '../lib/types'
import { clean, groups, hasChoices, mdHtml } from '../lib/markdown'
import { audioOf } from '../lib/audio'
import { BEHAVIOUR } from '../lib/behaviour'
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
            // F364: Original words shows when you point at the note (always on the phone)
            <span key={f.f} className="group/voice flex items-end gap-2">
              <button
                data-act="play"
                data-src={src}
                aria-label={`Play the voice note${voiceLen(f) ? `, ${clock(voiceLen(f) as number)}` : ''}`}
                className={`${HIT} flex h-9 shrink-0 items-center gap-2 self-end rounded-full border border-zinc-200 pr-3 pl-1 text-[13px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
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
                <button
                  data-act="as-said"
                  data-f={f.f}
                  className={`${HIT} h-8 shrink-0 self-end rounded-lg px-1.5 text-xs font-semibold text-zinc-500 group-hover/voice:opacity-100 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:opacity-100 lg:opacity-0 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
                >
                  Original words
                </button>
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
export function VoiceLine({ files, bare = false }: { files?: FileRef[]; bare?: boolean }) {
  const audio = (files || []).filter(isAudio)
  const tidy = !bare && P_CACHE.prefs?.tidy !== false // bare: Original words is in the message's ⋯ (B321)
  return (
    <>
      {audio.map((f) => {
        const src = fileUrl(f.f)
        return (
          <span key={f.f} className="flex items-center gap-1 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
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
                ·
                <button
                  data-act="as-said"
                  data-f={f.f}
                  className={`${HIT} h-7 rounded-lg px-1 font-medium hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
                >
                  Original words
                </button>
              </>
            ) : null}
          </span>
        )
      })}
    </>
  )
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
// F327 (as Yadong first had it): an answered question keeps its form, greyed and no longer clickable, with what you
// picked ticked and said once below
function Answered({ x, gid, done }: { x: Msg; gid: string; done: string[] }) {
  return (
    <>
      <div className="opacity-60 grayscale">
        <Rich text={x.text} gid={gid + 'q' + x.id} done={done} />
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">Submitted: {done.join(' · ')}</div>
    </>
  )
}
export function answerOf(thread: Msg[], x: Msg) {
  if (x.kind !== 'ask') return null
  const a = thread.slice(thread.indexOf(x) + 1).find(userWord)
  return a
    ? (a.text
        .split('\n')
        .map((l) => l.match(/^\s*✓\s*(.+)$/)?.[1]?.trim())
        .filter(Boolean) as string[])
    : null
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
          <div
            {...voiceAttr(src)}
            className="max-w-[85%] rounded-2xl rounded-tr-md bg-blue-600 px-4 py-2.5 text-[15px] leading-relaxed text-white dark:bg-blue-500 [&_[data-ref]]:text-white [&_[data-ref]]:underline [&_[data-ref]]:decoration-white/60 [&_[data-ref]]:underline-offset-2 [&_a]:text-white [&_a]:decoration-white/60 [&_blockquote]:border-white/50 [&_blockquote]:text-white/85 [&_button[data-act=more-msg]]:text-white [&_code]:bg-white/15 [&_code]:text-white [&_mark]:text-zinc-900 [&_pre]:bg-white/15 [&_pre]:text-white"
          >
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
          {ver?.old ? null : <VoiceLine files={src?.files} bare={!!src && !src.moved && !src.deleted} />}
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
                    title="See what changed"
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
          {src && !ver?.old && !src.moved && !src.deleted ? (
            <button
              data-act="input-more"
              data-id={src.id}
              aria-label={`Edit, add more, more for ${rcode(src.id)}`}
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
        <div className="flex items-center gap-2 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          <Avatar by={x.by} />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{whoName(x.by)}</span>
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
  const card = form
    ? 'space-y-2.5 border-amber-200 bg-amber-50 p-3 text-zinc-900 dark:border-amber-400/25 dark:bg-amber-400/7 dark:text-zinc-100'
    : 'border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
  return (
    <div className="group/msg flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
        <Avatar by={x.by} />
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{whoName(x.by)}</span>
        {done && !form ? (
          <span className="flex items-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-300">
            <Icon n="check" c="size-3" sw="3" />
            Submitted
          </span>
        ) : (
          <KindTag x={x} />
        )}
        <span>{when(x.t)}</span>
        {form || !U.open ? null : x.hidden ? (
          <button data-act="msg-hide" data-n={U.open} data-id={x.id} data-on={0} className={DC_BTN}>
            Keep shown
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
      </div>
      <div className={`w-full rounded-2xl rounded-tl-md border text-[15px] leading-relaxed ${card}`}>
        {form ? (
          <>
            <div className="px-1">
              <MsgText x={x} gid={gid} form={form} />
            </div>
            {hasChoices(x.text) ? <SendAnswerBtn n={form} /> : null}
          </>
        ) : done?.length && hasChoices(x.text) ? (
          <Answered x={x} gid={gid} done={done} />
        ) : (
          <MsgText x={x} gid={gid} done={done} />
        )}
        {strip(x.files, gid + 'm' + x.id, 'h-48 w-24')}
      </div>
    </div>
  )
}
// T274 #4: a comment on one of the item's documents shows among its messages, in time, as one line
export interface Note {
  t: string
  node: ReactNode
}
export function docNotes(n: number, from = ''): Note[] {
  return docsOf(n)
    .flatMap((d) => [
      ...d.blocks.flatMap((b) => b.comments.map((c) => ({ c, d, key: b.key }))),
      ...(d.whole || []).map((c) => ({ c, d, key: 'doc' })),
      ...d.detached.flatMap((t) => t.comments.map((c) => ({ c, d, key: t.key }))),
    ])
    .filter(({ c }) => c.t && (!from || c.t >= from))
    .sort((a, b) => a.c.t.localeCompare(b.c.t))
    .map(({ c, d, key }) => {
      const q = c.quote ? oneLine(c.quote) : ''
      return {
        t: c.t,
        node: (
          <button
            key={`dn${d.d}-${c.id}`}
            data-act="doc-at"
            data-d={d.d}
            data-key={key}
            className="flex items-start gap-2 self-stretch rounded-lg px-1 py-0.5 text-left text-[13px] leading-snug text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <Icon n="comment" c="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {c.by === 'you' ? 'You' : whoName(c.by)}
              </span>{' '}
              on <span className="font-mono">D{d.d}</span>
              {c.quote ? ` · “${q.slice(0, 40)}${q.length > 40 ? '…' : ''}”` : ''}: {oneLine(c.text).slice(0, 160)}
            </span>
            <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">{when(c.t)}</span>
          </button>
        ),
      }
    })
}
/** A document as a card: its title, code, comments and time; it opens in Taska (I289). */
export const DocCard = ({ d, cls = '' }: { d: Doc; cls?: string }) => (
  <button
    data-act="doc-open"
    data-d={d.d}
    className={`flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${cls}`}
  >
    <Icon n="doc" c="size-5 text-zinc-500 dark:text-zinc-400" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-medium">{d.title}</span>
      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
        D{d.d} · {plural(d.comments.length, 'comment')} · {when(d.t1)}
      </span>
    </span>
    <Icon n="right" c="size-4 text-zinc-300 dark:text-zinc-600" />
  </button>
)
/** I289: each document under the agent's message that made it: the first one after it was made that names it, else
 * the first one after it was made. -> message id -> its documents */
export function docsByMsg(it: Item): Map<number, Doc[]> {
  const out = new Map<number, Doc[]>(),
    agentMsgs = it.thread.filter((x) => !userWord(x) && x.by !== 'org')
  for (const d of docsOf(it.n)) {
    const named = new RegExp(`(^|[^\\w])D0*${d.d}(?!\\d)`)
    const after = agentMsgs.filter((x) => Date.parse(x.t) >= Date.parse(d.t0) - 60_000)
    const m = after.find((x) => named.test(x.text)) || after[0] || agentMsgs.find((x) => named.test(x.text))
    if (!m) continue
    if (!out.has(m.id)) out.set(m.id, [])
    out.get(m.id)?.push(d)
  }
  return out
}
export function Talk({ it, list, gid = '', notes = [] }: { it: Item; list: Msg[]; gid?: string; notes?: Note[] }) {
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
  const made = BEHAVIOUR.docCards ? docsByMsg(it) : new Map<number, Doc[]>()
  let k = 0
  const out: ReactNode[] = []
  const before = (t: string) => {
    while (k < notes.length && (!t || notes[k].t < t)) out.push(notes[k++].node)
  }
  for (const x of list) {
    before(x.t)
    out.push(
      <MsgView
        key={x.id}
        x={x}
        gid={gid}
        done={gone.has(x.id) ? null : answerOf(th, x)}
        ver={vers.get(x.id)}
        withdrawn={gone.has(x.id)}
        read={read?.id === x.id ? read : null}
      />,
    )
    for (const d of made.get(x.id) || []) out.push(<DocCard key={`d${d.d}-${x.id}`} d={d} cls="-mt-3" />)
  }
  before('')
  return <>{out}</>
}
