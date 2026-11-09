// A comment on one of the item's documents, as the item's talk shows it among its messages in time: yours in a blue
// bubble, an agent's in a card under its name, with what it is on (the words it quotes, struck through when they were
// changed since) and where (the document, a tap away). Props only.

import type { DocNote } from '../../model/talk'
import { when } from '../../model/time'
import { sayIn, sentNotes, voiceLacks } from '../../model/voiceStates'
import { hasIcon } from '../../model/words'
import { AgentName } from '../../ui/bits'
import { FileRows, VoiceBubble, isAudio } from '../../ui/Files'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import { BUSY, MUTED, YOU_BUBBLE } from '../../ui/tones'
import type { TalkLineEvents } from './Talk'
import type { TalkEnv } from './talkEnv'

/** A comment on one of the item's documents, in the talk among the messages (model/talk docNotes). */
export function DocComment({ n, env, on }: { n: DocNote; env: TalkEnv; on: TalkLineEvents }) {
  const { c, d, key, changed, about } = n
  const you = c.by === 'you'
  // the words it is about were changed in the document since: the quote struck through, and said
  const gone = changed ? <span className="shrink-0">· Original text changed</span> : null
  const where = (
    <button onClick={() => on.docAt(d, key)} className="-mx-1 rounded px-1 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
      on <span className="font-mono">D{d}</span>
    </button>
  )
  const quote = about ? (
    <button
      onClick={() => on.docAt(d, key)}
      className={`mb-1.5 line-clamp-3 block w-full border-l-2 pl-2 text-left text-[13px] leading-snug hover:underline ${changed ? 'line-through' : ''} ${you ? 'border-white/50 text-white/85 hover:text-white' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
    >
      {about}
    </button>
  ) : null
  // your voice notes inside your bubble, under its words (T668)
  const voices = you ? (c.files || []).filter(isAudio) : []
  // what was said: its typed words and its voice notes' words (their records, B682); a note with none yet says why
  const said = c.text.trim()
  const note = (c.files || []).find(isAudio)
  const notes = sentNotes(c.files)
  const hearing = !said && notes ? sayIn(notes, 'talk')?.say : null
  const words = said ? <Rich text={said} world={env.world} onRef={on.ref} onPicture={on.picture} /> : note && !(you && hearing) ? <span className={you ? 'text-white/70' : MUTED}>{voiceLacks(note.voice)}</span> : null
  // its pictures and files as a message's: thumbnails to open (yours under the bubble, an agent's in its card)
  const pics = (c.files || []).filter((f) => !isAudio(f))
  const strip = (cls: string) => (pics.length ? <FileRows files={pics} url={env.url} play={env.play} tidy={env.tidy} on={on} cls={cls} /> : null)
  return you ? (
    <div className="flex flex-col items-end gap-1">
      {voices.length ? (
        <VoiceBubble
          cls={YOU_BUBBLE}
          files={voices}
          url={env.url}
          play={env.play}
          tidy={env.tidy}
          top={
            quote || words ? (
              <>
                {quote}
                {words}
              </>
            ) : null
          }
          busy={c.id <= 0}
          hearing={hearing}
          on={on}
        />
      ) : quote || words ? (
        <div className={YOU_BUBBLE}>
          {quote}
          {words}
        </div>
      ) : null}
      {strip('items-end max-w-full [&>div]:max-w-full')}
      <div className={`flex max-w-full flex-wrap items-center justify-end gap-x-1 text-[11px] ${MUTED}`}>
        <span className="flex max-w-full min-w-0 items-center gap-0.5 px-1">
          <Icon n="comment" c="size-3 shrink-0" />
          <span className="min-w-0 truncate">
            {where} · {c.id > 0 ? when(c.t, env.now) : <span className={BUSY}>Sending…</span>} {gone}
          </span>
        </span>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-start gap-1.5">
      <div className={`flex max-w-full min-w-0 items-center gap-2 px-1 text-[11px] ${MUTED}`}>
        {/* who by its app's icon where it has one, then its session (T711) */}
        <AgentName by={c.by} cls="shrink-0 text-xs font-semibold text-zinc-700 dark:text-zinc-300" />
        {c.ses ? <span className={`min-w-0 truncate text-xs ${hasIcon(c.by) ? 'font-semibold text-zinc-700 dark:text-zinc-300' : '-ml-1 text-zinc-500 dark:text-zinc-400'}`}>{hasIcon(c.by) ? c.ses : `· ${c.ses}`}</span> : null}
        <Icon n="comment" c="size-3 shrink-0" />
        {where}
        <span className="-ml-1 shrink-0">· {when(c.t, env.now)}</span>
        {gone}
      </div>
      <div className="w-full rounded-2xl rounded-tl-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {quote}
        {words}
        {strip(words ? 'mt-3' : '')}
      </div>
    </div>
  )
}
