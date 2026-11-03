// Files that came with what was said: a voice note is one chip (play and its length), a picture a thumbnail, any
// other file a link with its name. Props only.

import type { FileRef } from '../model/types'
import { Pic } from './bits'
import { Icon } from './Icon'
import { HIT } from './tones'
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

function VoiceTime({ total, play }: { total: number | null; play: PlayState }) {
  if (play.t !== null && (play.playing || (total !== null && play.t < total - 500)))
    return (
      <>
        {clock(play.t)}
        {total !== null ? <span className="text-zinc-400 dark:text-zinc-500"> / {clock(total)}</span> : null}
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
          className="mr-1 -ml-1.5 grid size-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 lg:hidden dark:text-zinc-500 dark:hover:bg-zinc-800"
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
            <span className="truncate">{f.name}</span>
          </a>
        )
      })}
    </>
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
          <span key={f.f} className="flex items-center gap-1 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <button
              aria-label={`Play ${f.name}`}
              {...saidTip(f, tidy)}
              onClick={(e) => (e.stopPropagation(), on.play(src))}
              className={`${HIT} flex h-7 items-center gap-1 rounded-full px-1.5 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
            >
              <span>
                <Icon n={p.playing ? 'pausefill' : 'play'} c="size-3.5" />
              </span>
              <span className="font-mono tabular-nums">
                <VoiceTime total={voiceLength(f)} play={p} />
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
