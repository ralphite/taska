// Files that came with what was said: a voice note is one chip (play and its length), a picture a thumbnail, any
// other file a link with its name. Props only.

import type { ReactNode } from 'react'
import type { FileRef } from '../model/types'
import { Pic } from './bits'
import { Icon } from './Icon'
import { HIT, MUTED } from './tones'
import { clock } from '../model/time'

export const isAudio = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')
export const isImage = (f: { mime?: string }) => (f.mime || '').startsWith('image/')

/** A voice note's length from its name (voice_1-05.webm is 1:05), in ms; null when its name does not say. */
export const voiceLength = (f: FileRef) => {
  const m = /(\d+)-(\d+)\.\w+$/.exec(f.name || '')
  return m ? (60 * +m[1] + +m[2]) * 1000 : null
}


export interface PlayState {
  playing: boolean
  /** how far it got, ms (null: not started) */
  t: number | null
}

function VoiceTime({ total, play, quiet = MUTED }: { total: number | null; play: PlayState; quiet?: string }) {
  if (play.t !== null && (play.playing || (total !== null && play.t < total - 500)))
    return (
      <>
        {clock(play.t)}
        {total !== null ? <span className={quiet}> / {clock(total)}</span> : null}
      </>
    )
  return <>{total !== null ? clock(total) : play.t !== null ? clock(play.t) : 'Play'}</>
}

/** On the desktop, pointing at a voice note's play button shows its original words in the page's tooltip (they are
 * here already: nothing to click, B640). Its word-for-word words and the tidied ones go to the tooltip as data; the
 * tip goes under the note, clear of the words written above it (above only when there is no room below). */
const saidTip = (f: FileRef, tidy: boolean) => (tidy ? { 'data-heard': f.heard ?? '', 'data-tidied': f.tr ?? '', 'data-tip-side': 'bottom' } : {})

export function VoiceChip({ f, src, play, tidy, onPlay, onWords }: { f: FileRef; src: string; play: PlayState; tidy: boolean; onPlay(src: string): void; onWords(f: string): void }) {
  const total = voiceLength(f)
  return (
    <span className="flex h-9 shrink-0 items-center self-end rounded-full border border-zinc-200 pl-1 text-[13px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      <button
        aria-label={`Play the voice note${total ? `, ${clock(total)}` : ''}`}
        {...saidTip(f, tidy)}
        onClick={(e) => (e.stopPropagation(), onPlay(src))}
        className={`${HIT} flex h-full items-center gap-2 rounded-full pr-3 hover:text-zinc-900 dark:hover:text-white`}
      >
        <span className="grid size-7 place-items-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <Icon n={play.playing ? 'pausefill' : 'play'} c="size-3.5" />
        </span>
        <span className="font-mono tabular-nums">
          <VoiceTime total={total} play={play} />
        </span>
      </button>
      {tidy ? (
        <button
          aria-label="Original words"
          onClick={(e) => (e.stopPropagation(), onWords(f.f))}
          className={`relative mr-1 -ml-1.5 grid size-7 place-items-center rounded-full after:absolute after:-inset-2 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800 ${MUTED}`}
        >
          <Icon n="quote" c="size-4" />
        </button>
      ) : null}
    </span>
  )
}

export interface FileEvents {
  play(src: string): void
  words(f: string): void
  /** a picture in the viewer, with the others of the same message */
  view(f: string, all: string[]): void
}

export function Thumbs({
  files,
  url,
  size = 'size-20',
  play,
  tidy,
  on,
}: {
  files: FileRef[]
  url(f: string): string
  size?: string
  play(src: string): PlayState
  tidy: boolean
  on: FileEvents
}) {
  const pictures = files.filter(isImage).map((f) => f.f)
  return (
    <>
      {files.map((f) => {
        if (isAudio(f)) {
          const src = url(f.f)
          return <VoiceChip key={f.f} f={f} src={src} play={play(src)} tidy={tidy} onPlay={on.play} onWords={on.words} />
        }
        if (isImage(f))
          return (
            <button
              key={f.f}
              title={f.name}
              onClick={(e) => (e.stopPropagation(), on.view(f.f, pictures))}
              className={`${size} shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 hover:brightness-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:brightness-110`}
            >
              <Pic src={url(f.f)} alt={f.name} cls="size-full object-contain" />
            </button>
          )
        return (
          <a
            key={f.f}
            href={url(f.f)}
            target="_blank"
            rel="noopener"
            className="flex h-11 max-w-56 shrink-0 items-center gap-1.5 self-end rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Icon n="file" c="size-4" />
            <FileName name={f.name} />
          </a>
        )
      })}
    </>
  )
}

/** A file's size as a list says it: 34 KB, 1.2 MB. */
export const sizeWord = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

const CHIP =
  'inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100/90 p-1.5 pr-3 shadow-2xs transition-colors hover:bg-zinc-200/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'

/** An input's files as the lists of inputs draw them (T661): a voice note a pill (play and its length; on the
 * desktop, pointing at it shows its original words), a picture a chip with a small view of it, its name and size,
 * any other file a chip with its mark, name and size. */
export function FileChips({ files, url, play, tidy, on }: { files: FileRef[]; url(f: string): string; play(src: string): PlayState; tidy: boolean; on: FileEvents }) {
  const pictures = files.filter(isImage).map((f) => f.f)
  const label = (f: FileRef) => (
    <span className="min-w-0 text-left font-mono">
      <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">{f.name}</span>
      {f.size ? <span className="block text-[10px] text-zinc-400">{sizeWord(f.size)}</span> : null}
    </span>
  )
  return (
    <>
      {files.map((f) => {
        if (isAudio(f)) {
          const src = url(f.f)
          const total = voiceLength(f)
          const p = play(src)
          return (
            <span key={f.f} className="inline-flex items-center rounded-full border border-zinc-200/80 bg-zinc-100 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <button
                aria-label={`Play the voice note${total ? `, ${clock(total)}` : ''}`}
                {...saidTip(f, tidy)}
                onClick={(e) => (e.stopPropagation(), on.play(src))}
                className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 transition-colors hover:bg-zinc-200/80 dark:hover:bg-zinc-800"
              >
                <Icon n={p.playing ? 'pausefill' : 'play'} c="size-3 text-zinc-900 dark:text-zinc-100" />
                <span className="tabular-nums">
                  <VoiceTime total={total} play={p} />
                </span>
              </button>
              {/* the phone has no pointing: its original words open from a small mark at the note's end (B640) */}
              {tidy ? (
                <button
                  aria-label="Original words"
                  onClick={(e) => (e.stopPropagation(), on.words(f.f))}
                  className="relative mr-1 -ml-1.5 grid size-5 place-items-center rounded-full text-zinc-500 after:absolute after:-inset-3 hover:bg-zinc-200/80 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <Icon n="quote" c="size-3" />
                </button>
              ) : null}
            </span>
          )
        }
        if (isImage(f))
          return (
            <button key={f.f} title={f.name} onClick={(e) => (e.stopPropagation(), on.view(f.f, pictures))} className={CHIP}>
              <span className="h-8 w-11 shrink-0 overflow-hidden rounded border border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
                <Pic src={url(f.f)} alt={f.name} cls="size-full object-cover" />
              </span>
              {label(f)}
            </button>
          )
        return (
          <a key={f.f} href={url(f.f)} target="_blank" rel="noopener" title={f.name} className={`${CHIP} gap-2.5`}>
            <span className="grid size-8 shrink-0 place-items-center rounded border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/80 dark:text-teal-400">
              <Icon n="file" c="size-4" sw="2" />
            </span>
            {label(f)}
          </a>
        )
      })}
    </>
  )
}

/** A file's name on one line; too long, it is cut in the middle, so its end and its kind stay (Quarter…port.pdf). */
export function FileName({ name }: { name: string }) {
  const dot = name.lastIndexOf('.')
  const keep = Math.min(name.length, (dot > 0 ? name.length - dot : 0) + 4)
  return (
    <span title={name} className="flex min-w-0 whitespace-pre">
      <span className="truncate">{name.slice(0, name.length - keep)}</span>
      <span className="shrink-0">{name.slice(name.length - keep)}</span>
    </span>
  )
}

/** Pictures and files in one row you can slide, voice notes in a row of their own below. */
export function FileRows({ files, cls = '', ...rest }: { files: FileRef[]; cls?: string; url(f: string): string; size?: string; play(src: string): PlayState; tidy: boolean; on: FileEvents }) {
  const audio = files.filter(isAudio)
  const others = files.filter((f) => !isAudio(f))
  return (
    <div className={`${cls} flex flex-col gap-2`}>
      {others.length ? (
        <div className={`flex items-end gap-2 overflow-x-auto lg:scrollbar-thin ${others.length > 3 ? '[mask-image:linear-gradient(to_right,black_85%,transparent)]' : ''}`}>
          <Thumbs files={others} {...rest} />
        </div>
      ) : null}
      {audio.length ? (
        <div className="flex flex-wrap gap-2">
          <Thumbs files={audio} {...rest} />
        </div>
      ) : null}
    </div>
  )
}

/** Your voice note under your words: one small line: play, its length, the original words (the phone's button; on
 * the desktop, pointing at play shows them). `bare`: the phone has them in the message's menu instead. */
export function VoiceLine({ files, url, play, tidy, bare = false, on }: { files: FileRef[]; url(f: string): string; play(src: string): PlayState; tidy: boolean; bare?: boolean; on: FileEvents }) {
  const words = tidy && !bare
  return (
    <>
      {files.filter(isAudio).map((f) => {
        const src = url(f.f)
        const p = play(src)
        return (
          <span key={f.f} className={`flex items-center gap-1 px-1 text-[11px] ${MUTED}`}>
            <button
              aria-label={`Play ${f.name}`}
              {...saidTip(f, tidy)}
              onClick={(e) => (e.stopPropagation(), on.play(src))}
              className={`${HIT} flex h-7 items-center gap-1 rounded-full px-1.5 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
            >
              {/* the time grows to the left: the button stays where it was pressed */}
              <span className="font-mono tabular-nums">
                <VoiceTime total={voiceLength(f)} play={p} />
              </span>
              <span>
                <Icon n={p.playing ? 'pausefill' : 'play'} c="size-3.5" />
              </span>
            </button>
            {words ? (
              <>
                <span className="lg:hidden">·</span>
                <button
                  onClick={(e) => (e.stopPropagation(), on.words(f.f))}
                  className={`${HIT} h-7 rounded-lg px-1 font-medium hover:bg-zinc-100 hover:text-zinc-700 lg:hidden dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
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

/** T668, a prototype (Yadong picks one): your voice note inside your own blue bubble, not under it. The page leaves
 * it unset: the note stays under the bubble (VoiceLine). pill: a soft pill with a white disc and its time; shelf: a
 * strip docked at the bubble's foot with a track for how far it got; disc: a white disc and its time right on the
 * blue, a row of dots for how far it got. Each design is Gemini's. */
export type BubbleVoiceLook = 'pill' | 'shelf' | 'disc'

const DELAYS = [0, 200, 400]
/** words still being written out: a quiet mark in the bubble where they will be */
function Hearing({ look }: { look: BubbleVoiceLook }) {
  const dots = (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {DELAYS.map((d) => (
        <span key={d} className="size-1.5 animate-pulse rounded-full bg-white/70" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
  if (look === 'disc')
    return (
      <span role="status" aria-label="Transcribing" className="flex py-1.5">
        {dots}
      </span>
    )
  return (
    <span role="status" className="flex items-center gap-1.5 py-0.5 text-[13px] text-white/70">
      {look === 'shelf' ? dots : null}
      {look === 'shelf' ? 'transcribing…' : 'transcribing'}
      {look === 'pill' ? dots : null}
    </span>
  )
}

/** how far it got, 0 to 1 */
const part = (total: number | null, play: PlayState) => (total && play.t !== null ? Math.min(1, play.t / total) : 0)

/** One voice note's player in the bubble. `solo`: nothing else is in the bubble, so the bubble is the player.
 * `busy`: still on its way, it cannot be played yet. */
export function BubblePlayer({ f, src, play, tidy, look, solo = false, busy = false, meter = true, onPlay }: {
  f: FileRef
  src: string
  play: PlayState
  tidy: boolean
  look: BubbleVoiceLook
  solo?: boolean
  busy?: boolean
  meter?: boolean
  onPlay(src: string): void
}) {
  const total = voiceLength(f)
  const icon = <Icon n={play.playing ? 'pausefill' : 'play'} c="size-3.5" />
  const time = <VoiceTime total={total} play={play} quiet="text-white/60" />
  const press = {
    'aria-label': `${play.playing ? 'Pause' : 'Play'} the voice note${total ? `, ${clock(total)}` : ''}`,
    ...saidTip(f, tidy),
    disabled: busy,
    onClick: (e: { stopPropagation(): void }) => (e.stopPropagation(), onPlay(src)),
  }
  const disc = (size: string) => <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-white text-blue-600 shadow-sm dark:text-blue-500`}>{icon}</span>
  if (look === 'pill')
    return solo ? (
      <button {...press} className="flex min-h-11 min-w-34 items-center gap-2.5 rounded-2xl rounded-tr-md bg-blue-600 py-2 pr-4 pl-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-70 dark:bg-blue-500 dark:hover:bg-blue-600">
        {disc('size-7')}
        <span className="font-mono text-[13px] font-medium tabular-nums">{time}</span>
      </button>
    ) : (
      <button
        {...press}
        className={`inline-flex min-h-[38px] items-center gap-2.5 rounded-full border py-1 pr-3.5 pl-1.5 text-white transition-colors disabled:opacity-60 ${play.playing ? 'border-white/30 bg-white/25' : 'border-white/20 bg-white/15 hover:bg-white/25'}`}
      >
        {disc('size-7')}
        <span className="font-mono text-[13px] font-medium tabular-nums">{time}</span>
      </button>
    )
  if (look === 'shelf') {
    const row = (
      <>
        <button {...press} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 disabled:bg-white/10 disabled:text-white/50 lg:size-7">
          {icon}
        </button>
        <span className="flex flex-1 items-center py-2" aria-hidden="true">
          <span className="block h-1 w-full overflow-hidden rounded-full bg-white/25">
            <span className="block h-full rounded-full bg-white" style={{ width: `${part(total, play) * 100}%` }} />
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] text-white/95 tabular-nums">{time}</span>
      </>
    )
    return solo ? (
      <span className={`flex w-fit max-w-[85%] min-w-50 items-center gap-2.5 rounded-2xl rounded-tr-md bg-blue-600 px-3.5 py-2 text-white dark:bg-blue-500 ${busy ? 'opacity-70' : ''}`}>{row}</span>
    ) : (
      <span className="flex items-center gap-2.5 px-3.5 py-1.5">{row}</span>
    )
  }
  if (solo)
    return (
      <button {...press} className="flex h-10 items-center gap-2.5 rounded-full bg-blue-600 pr-3.5 pl-1.5 text-white transition-colors hover:bg-blue-700 disabled:opacity-70 dark:bg-blue-500 dark:hover:bg-blue-600">
        {disc('size-7')}
        <span className="font-mono text-[13px] font-medium tabular-nums">{time}</span>
      </button>
    )
  const lit = Math.round(part(total, play) * 8)
  return (
    <span className={`flex items-center gap-2.5 ${busy ? 'opacity-60' : ''}`}>
      <button {...press} className="rounded-full transition-transform active:scale-95">
        {disc('size-9 lg:size-8')}
      </button>
      <span className="font-mono text-[13px] font-medium text-white/95 tabular-nums">{time}</span>
      {meter ? (
        <span className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={`size-1 rounded-full ${play.t === null ? 'bg-white/40' : i < lit ? 'bg-white' : 'bg-white/35'}`} />
          ))}
        </span>
      ) : null}
    </span>
  )
}

/** Your bubble with its voice notes inside (T668): what you said on top (`top`: the quote of a comment, the words),
 * the notes under it; with nothing on top, the bubble is the player. */
export function VoiceBubble({ look, cls, files, url, play, tidy, top, hearing = false, busy = false, attrs, onPlay }: {
  look: BubbleVoiceLook
  /** the blue bubble's own classes */
  cls: string
  files: FileRef[]
  url(f: string): string
  play(src: string): PlayState
  tidy: boolean
  top?: ReactNode
  hearing?: boolean
  busy?: boolean
  attrs?: Record<string, string>
  onPlay(src: string): void
}) {
  const one = (f: FileRef, o: { solo?: boolean; meter?: boolean } = {}) => {
    const src = url(f.f)
    return <BubblePlayer key={f.f} f={f} src={src} play={play(src)} tidy={tidy} look={look} busy={busy} onPlay={onPlay} {...o} />
  }
  if (!top && !hearing)
    return (
      <div {...attrs} className="flex max-w-full flex-col items-end gap-1">
        {files.map((f) => one(f, { solo: true }))}
      </div>
    )
  const head = (
    <>
      {top}
      {hearing ? <Hearing look={look} /> : null}
    </>
  )
  if (look === 'shelf')
    return (
      <div {...attrs} className={`${cls} min-w-52 ${busy ? 'opacity-70' : ''}`}>
        {head}
        <div className="-mx-4 mt-2.5 -mb-2.5 divide-y divide-white/10 rounded-b-2xl border-t border-white/15 bg-black/[0.08] dark:bg-black/20">{files.map((f) => one(f))}</div>
      </div>
    )
  return (
    <div {...attrs} className={`${cls} ${busy ? 'opacity-70' : ''}`}>
      {head}
      <div className={`mt-2.5 flex flex-wrap items-center ${look === 'disc' ? 'gap-x-5 gap-y-2' : 'gap-2'}`}>{files.map((f) => one(f, { meter: files.length === 1 }))}</div>
    </div>
  )
}
