// Files that came with what was said: a voice note is one chip (play and its length), a picture a thumbnail, any
// other file a link with its name. Props only.

import type { FileRef } from '../../model/types'
import { Pic } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { HIT } from '../../ui/tones'

export const isAudio = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')
export const isImage = (f: { mime?: string }) => (f.mime || '').startsWith('image/')

/** A voice note's length from its name (voice_1-05.webm is 1:05), in ms; null when its name does not say. */
export const voiceLength = (f: FileRef) => {
  const m = /(\d+)-(\d+)\.\w+$/.exec(f.name || '')
  return m ? (60 * +m[1] + +m[2]) * 1000 : null
}

export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

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

/** Pointing at a voice note floats this bar above it, as a selection does, with its original words. `beside`: under
 * your words, to the note's left, in the line's empty room. */
function WordsBar({ f, beside = false, onWords }: { f: string; beside?: boolean; onWords(f: string): void }) {
  return (
    <span className={`absolute z-20 hidden lg:group-focus-within/voice:block lg:group-hover/voice:block ${beside ? 'top-0 right-full pr-1.5' : 'bottom-full left-0 pb-1.5'}`}>
      <span className="flex rounded-full bg-zinc-900 p-1 shadow-lg ring-1 ring-black/10 dark:bg-zinc-100 dark:ring-white/10">
        <button
          onClick={(e) => (e.stopPropagation(), onWords(f))}
          className="flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"
        >
          <Icon n="quote" c="size-4" />
          Original words
        </button>
      </span>
    </span>
  )
}

export function VoiceChip({ f, src, play, tidy, bar = false, onPlay, onWords }: { f: FileRef; src: string; play: PlayState; tidy: boolean; bar?: boolean; onPlay(src: string): void; onWords(f: string): void }) {
  const total = voiceLength(f)
  return (
    <span className="group/voice relative flex h-9 shrink-0 items-center self-end rounded-full border border-zinc-200 pl-1 text-[13px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      <button
        aria-label={`Play the voice note${total ? `, ${clock(total)}` : ''}`}
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
      {tidy && bar ? <WordsBar f={f.f} onWords={onWords} /> : null}
    </span>
  )
}

export interface FileEvents {
  play(src: string): void
  words(f: string): void
  view(f: string): void
}

export function Thumbs({
  files,
  url,
  size = 'size-20',
  play,
  tidy,
  bar = false,
  on,
}: {
  files: FileRef[]
  url(f: string): string
  size?: string
  play(src: string): PlayState
  tidy: boolean
  /** a voice note floats its original words above it when pointed at (the talk; not the list of what you said) */
  bar?: boolean
  on: FileEvents
}) {
  return (
    <>
      {files.map((f) => {
        if (isAudio(f)) {
          const src = url(f.f)
          return <VoiceChip key={f.f} f={f} src={src} play={play(src)} tidy={tidy} bar={bar} onPlay={on.play} onWords={on.words} />
        }
        if (isImage(f))
          return (
            <button
              key={f.f}
              title={f.name}
              onClick={(e) => (e.stopPropagation(), on.view(f.f))}
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
          <Thumbs files={others} bar {...rest} />
        </div>
      ) : null}
      {audio.length ? (
        <div className="flex flex-wrap gap-2">
          <Thumbs files={audio} bar {...rest} />
        </div>
      ) : null}
    </div>
  )
}

/** Your voice note under your words: one small line: play, its length, the original words. `bare`: its original
 * words are in the message's menu instead. */
export function VoiceLine({ files, url, play, tidy, bare = false, beside = false, on }: { files: FileRef[]; url(f: string): string; play(src: string): PlayState; tidy: boolean; bare?: boolean; beside?: boolean; on: FileEvents }) {
  const words = tidy && !bare
  return (
    <>
      {files.filter(isAudio).map((f) => {
        const src = url(f.f)
        const p = play(src)
        return (
          <span key={f.f} className="group/voice relative flex items-center gap-1 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <button
              aria-label={`Play ${f.name}`}
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
                <WordsBar f={f.f} beside={beside} onWords={on.words} />
              </>
            ) : null}
          </span>
        )
      })}
    </>
  )
}
