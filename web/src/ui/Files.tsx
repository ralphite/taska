// Files that came with what was said: a voice note is one chip everywhere (play, its length, its original words; r1165),
// a picture a thumbnail, any other file a link with its name. Props only.

import type { ReactNode } from 'react'
import type { FileRef, VoiceStep } from '../model/types'
import { Pic } from './bits'
import { Icon } from './Icon'
import { HIT, MUTED } from './tones'
import { clock } from '../model/time'
import { stepsInOrder } from '../model/voiceSteps'

export const isAudio = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')
export const isImage = (f: { mime?: string }) => (f.mime || '').startsWith('image/')

/** A voice note's length from its name (voice_1-05.webm is 1:05), in ms; null when its name does not say. */
export const voiceLength = (f: FileRef) => {
  const m = /(\d+)-(\d+)\.\w+$/.exec(f.name || '')
  return m ? (60 * +m[1] + +m[2]) * 1000 : null
}


const STEP_NAME: Record<string, string> = {
  pro: 'Strong model',
  asr: 'Speech model',
  pro_loud: 'Strong model, louder',
  asr_loud: 'Speech model, louder',
  pieces: 'Piece by piece',
  vote: 'Reviewers voted',
  said: 'Word for word',
  tidy: 'Tidied · what agents get',
}
const stepName = (step: string) => {
  const n = /^(.*)_(\d+)$/.exec(step)
  return n && STEP_NAME[n[1]] ? `${STEP_NAME[n[1]]}, try ${n[2]}` : STEP_NAME[step] || step
}

/** How a voice note's words came about (T697, B727): every step in the order its words arrived, the first words in
 * full, each later step only as what it changed (struck out, and marked), so no words show twice; a check on the
 * words chosen. The same in the phone's sheet and the desktop's tip (`tip`: on the tip's dark ground). */
export function VoiceSteps({ steps, tip = false }: { steps: VoiceStep[]; tip?: boolean }) {
  const added = tip ? 'rounded-sm bg-emerald-400/25 dark:bg-emerald-600/20' : 'rounded-sm bg-emerald-100 dark:bg-emerald-400/20'
  return (
    <ol className="flex flex-col gap-3">
      {stepsInOrder(steps).map(({ step: s, diff, full }, i) => (
        <li key={i} className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] leading-5">
            {s.chosen ? <Icon n="check" c={`size-3.5 ${tip ? 'text-emerald-400 dark:text-emerald-600' : 'text-emerald-600 dark:text-emerald-400'}`} sw="2.5" /> : null}
            <span className="shrink-0 font-semibold">{stepName(s.step)}</span>
            {s.model ? <span className="min-w-0 truncate opacity-70">{s.model}</span> : null}
            {s.secs !== undefined ? <span className="ml-auto shrink-0 tabular-nums opacity-70">{s.secs} s</span> : null}
          </div>
          <p className={`mt-0.5 break-words whitespace-pre-wrap ${s.error || !(full || diff) ? 'italic opacity-70' : ''}`}>
            {s.error
              ? s.error
              : full
                ? s.text
                : diff
                  ? diff.map((d, k) => (d.mark === 'removed' ? <del key={k} className="opacity-50">{d.text}</del> : d.mark === 'added' ? <mark key={k} className={`text-inherit ${added}`}>{d.text}</mark> : <span key={k}>{d.text}</span>))
                  : s.text
                    ? 'Same words'
                    : 'No words'}
          </p>
        </li>
      ))}
    </ol>
  )
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
 * here already: nothing to click, B640). Its word-for-word words and the tidied ones go to the tooltip as data, and
 * its file, for the steps that worked them out (T697); the tip goes under the note, clear of the words written above
 * it (above only when there is no room below). */
const saidTip = (f: FileRef, tidy: boolean) => (tidy && f.voice ? { 'data-heard': f.voice.said, 'data-tidied': f.voice.tidied, 'data-voice': f.f, 'data-tip-side': 'bottom' } : {})

/** A voice note, the one way every place draws it (r1165): play, its length, and on the phone a mark for its original
 * words (on the desktop, pointing at play shows them). `blue`: in your blue bubble, the same chip in white on blue.
 * `busy`: still on its way, it cannot be played yet. */
export function VoiceChip({ f, src, play, tidy, blue = false, busy = false, onPlay, onWords }: {
  f: FileRef
  src: string
  play: PlayState
  tidy: boolean
  blue?: boolean
  busy?: boolean
  onPlay(src: string): void
  onWords(f: string): void
}) {
  const total = voiceLength(f)
  const t = blue
    ? { chip: 'border-white/35 text-white', play: 'hover:text-white', disc: 'bg-white text-blue-600 dark:text-blue-500', quiet: 'text-white/60', quote: 'text-white/80 hover:bg-white/15' }
    : {
        chip: 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
        play: 'hover:text-zinc-900 dark:hover:text-white',
        disc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
        quiet: MUTED,
        quote: `hover:bg-zinc-100 dark:hover:bg-zinc-800 ${MUTED}`,
      }
  return (
    <span className={`flex h-9 shrink-0 items-center self-end rounded-full border pl-1 text-[13px] ${t.chip}`}>
      <button
        aria-label={`Play the voice note${total ? `, ${clock(total)}` : ''}`}
        {...saidTip(f, tidy)}
        disabled={busy}
        onClick={(e) => (e.stopPropagation(), onPlay(src))}
        className={`${HIT} flex h-full items-center gap-2 rounded-full pr-3 ${t.play}`}
      >
        <span className={`grid size-7 place-items-center rounded-full ${t.disc}`}>
          <Icon n={play.playing ? 'pausefill' : 'play'} c="size-3.5" />
        </span>
        <span className="font-mono tabular-nums">
          <VoiceTime total={total} play={play} quiet={t.quiet} />
        </span>
      </button>
      {tidy ? (
        <button
          aria-label="Original words"
          onClick={(e) => (e.stopPropagation(), onWords(f.f))}
          className={`relative mr-1 -ml-1.5 grid size-7 place-items-center rounded-full after:absolute after:-inset-2 lg:hidden ${t.quote}`}
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
            className={`${HIT} flex h-9 max-w-56 shrink-0 items-center gap-1.5 self-end rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
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

// as tall as a voice note's chip (h-9), so a row of files lines up (B733)
const CHIP =
  'inline-flex h-9 max-w-full min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100/90 p-0.5 pr-3 shadow-2xs transition-colors hover:bg-zinc-200/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'

/** An input's files as the lists of inputs draw them (T661): a voice note its chip (VoiceChip, r1165), a picture a chip with a small view of it, its name and size,
 * any other file a chip with its mark, name and size. */
export function FileChips({ files, url, play, tidy, on }: { files: FileRef[]; url(f: string): string; play(src: string): PlayState; tidy: boolean; on: FileEvents }) {
  const pictures = files.filter(isImage).map((f) => f.f)
  const label = (f: FileRef) => (
    <span className="min-w-0 text-left font-mono">
      <span className="block truncate text-xs leading-4 font-medium text-zinc-800 dark:text-zinc-200">{f.name}</span>
      {f.size ? <span className="block text-[10px] leading-3 text-zinc-400">{sizeWord(f.size)}</span> : null}
    </span>
  )
  return (
    <>
      {files.map((f) => {
        if (isAudio(f)) {
          const src = url(f.f)
          return <VoiceChip key={f.f} f={f} src={src} play={play(src)} tidy={tidy} onPlay={on.play} onWords={on.words} />
        }
        if (isImage(f))
          return (
            <button key={f.f} title={f.name} onClick={(e) => (e.stopPropagation(), on.view(f.f, pictures))} className={CHIP}>
              <span className="h-full w-11 shrink-0 overflow-hidden rounded-md border border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
                <Pic src={url(f.f)} alt={f.name} cls="size-full object-cover" />
              </span>
              {label(f)}
            </button>
          )
        return (
          <a key={f.f} href={url(f.f)} target="_blank" rel="noopener" title={f.name} className={`${CHIP} gap-2.5`}>
            <span className="grid aspect-square h-full shrink-0 place-items-center rounded-md border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/80 dark:text-teal-400">
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

const DELAYS = [0, 200, 400]
/** words still being written out: a quiet mark in the bubble where they will be (`say`: its words) */
function Transcribing({ say }: { say: string }) {
  return (
    <span role="status" className="flex items-center gap-1.5 py-0.5 text-[13px] text-white/70">
      {say}
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        {DELAYS.map((d) => (
          <span key={d} className="size-1.5 animate-pulse rounded-full bg-white/70" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
    </span>
  )
}

/** Your blue bubble with your voice notes inside it (T668): what you said on top (`top`: a comment's quote, the
 * words), each note's chip under it, the chip every place draws (r1165), in white on blue; with nothing on top, the
 * bubble holds the chips alone. */
export function VoiceBubble({ cls, files, url, play, tidy, top, hearing = null, busy = false, attrs, on }: {
  /** the blue bubble's own classes */
  cls: string
  files: FileRef[]
  url(f: string): string
  play(src: string): PlayState
  tidy: boolean
  top?: ReactNode
  /** its words still to come: what the mark says (model/voiceStates, the talk's), none when they are in */
  hearing?: string | null
  busy?: boolean
  attrs?: Record<string, string>
  on: Pick<FileEvents, 'play' | 'words'>
}) {
  const alone = !top && !hearing
  return (
    <div {...attrs} className={`${cls} ${alone ? 'p-1.5!' : ''} ${busy ? 'opacity-70' : ''}`}>
      {top}
      {hearing ? <Transcribing say={hearing} /> : null}
      <div className={`flex flex-wrap items-center gap-2 ${alone ? '' : 'mt-2.5'}`}>
        {files.map((f, i) => {
          const src = url(f.f)
          return <VoiceChip key={`${f.f}-${i}`} f={f} src={src} play={play(src)} tidy={tidy} blue busy={busy} onPlay={on.play} onWords={on.words} />
        })}
      </div>
    </div>
  )
}
