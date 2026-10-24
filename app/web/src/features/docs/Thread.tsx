// A comment thread of a document: its comments (yours can be edited; any can be moved or deleted; a file of yours
// taken off), the words it quotes when they are not the whole paragraph, Resolve or Reopen, and Reply. A comment not
// sent yet shows where it will go. Props only.

import { plainQuote } from '../../model/markdown'
import { sameText, type Thread as DocThread } from '../../model/docs'
import { when } from '../../model/time'
import type { Comment, FileRef } from '../../model/types'
import { plural, whoName } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import { COMMENT_CARD, COMMENT_WHO, DC_BTN, HIT } from '../../ui/tones'
import { Thumbs, VoiceLine, type FileEvents, type PlayState } from '../../ui/Files'
import type { InlineWorld } from '../../ui/markdown/inline'

/** What a document's parts draw with. */
export interface DocEnv {
  world: InlineWorld
  now: number
  desk: boolean
  tidy: boolean
  play(src: string): PlayState
  url(fid: string): string
}

export interface ThreadEvents extends FileEvents {
  ref(code: string): void
  picture(fid: string, all: string[]): void
  edit(id: number): void
  move(id: number): void
  takeOff(id: number, f: string): void
  remove(id: number): void
  resolve(tk: string, on: boolean): void
  reply(tk: string): void
}

const isAudio = (f: FileRef) => (f.mime || '').startsWith('audio/')

export const NewDot = () => <span className="ml-0.5 size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" title="New from an agent" />

function CommentActs({ c, asking, on }: { c: Comment; asking: string | null; on: ThreadEvents }) {
  return (
    // on the desktop they float at the end of the line with who wrote it while you point at it, taking no line of
    // their own, and not over the card's top corner, where the words it quotes are
    <div className="-mr-1.5 ml-auto flex gap-0.5 lg:invisible lg:absolute lg:top-0 lg:right-0 lg:z-10 lg:mr-0 lg:rounded-lg lg:bg-white lg:shadow-sm lg:ring-1 lg:ring-zinc-900/10 lg:group-hover:visible lg:focus-within:visible dark:lg:bg-zinc-800 dark:lg:ring-white/10">
      {c.by === 'you' ? (
        <button onClick={() => on.edit(c.id)} className={DC_BTN}>
          <Icon n="pencil" c="size-3.5" />
          Edit
        </button>
      ) : null}
      <button onClick={() => on.move(c.id)} className={DC_BTN}>
        <Icon n="arrow" c="size-3.5" />
        Move
      </button>
      {c.by === 'you'
        ? (c.files || []).map((f) => (
            <button key={f.f} onClick={() => on.takeOff(c.id, f.f)} title={`Take off ${f.name || 'the file'}`} className={DC_BTN}>
              <Icon n="x" c="size-3.5" />
              {asking === `${c.id} ${f.f}` ? 'Take it off?' : 'File'}
            </button>
          ))
        : null}
      <button onClick={() => on.remove(c.id)} className={DC_BTN}>
        <Icon n="trash" c="size-3.5" />
        Delete
      </button>
    </div>
  )
}

export function Thread({ t, blockText, rail = false, isNew, done, replying, asking, env, on }: {
  t: DocThread
  /** the paragraph's words (a quote of all of them is not shown again) */
  blockText?: string
  /** a card beside the text (the desktop), not a line under the paragraph */
  rail?: boolean
  isNew: boolean
  done: boolean
  replying: boolean
  /** the file whose Take off waits for its second click: "id fid" */
  asking: string | null
  env: DocEnv
  on: ThreadEvents
}) {
  return (
    <div data-thread={t.tk} className={rail ? 'space-y-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900' : 'mt-2 space-y-2 border-l-2 border-amber-300 pl-3 dark:border-amber-600'}>
      {isNew ? (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          <NewDot />
          New
        </div>
      ) : null}
      {t.comments.map((c) => (
        <div key={c.id} className={`group relative text-sm ${COMMENT_CARD(c.by)}`}>
          {blockText !== undefined && !sameText(c.quote, blockText) ? <div className="mb-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-300">“{plainQuote(c.quote)}”</div> : null}
          <div className="flex min-h-6 flex-wrap items-center gap-1 lg:relative">
            <span className={COMMENT_WHO(c.by)}>{whoName(c.by)}</span>{' '}
            <span className="text-xs text-zinc-400">
              {when(c.t, env.now)}
              {c.edited ? ` · edited ${when(c.edited, env.now)}` : ''}
            </span>
            {/* a comment shown while it is being saved has nothing to edit or delete yet */}
            {c.id > 0 ? <CommentActs c={c} asking={asking} on={on} /> : null}
          </div>
          <Rich text={c.text} world={env.world} onRef={on.ref} onPicture={on.picture} />
          {c.files?.some((f) => !isAudio(f)) ? (
            <div className="mt-1.5 flex gap-2 overflow-x-auto">
              <Thumbs files={c.files.filter((f) => !isAudio(f))} url={env.url} size="size-11" play={env.play} tidy={env.tidy} on={on} />
            </div>
          ) : null}
          <VoiceLine files={c.files || []} url={env.url} play={env.play} tidy={env.tidy} on={on} />
        </div>
      ))}
      <button
        onClick={() => on.resolve(t.tk, !done)}
        className={`${HIT} float-right flex h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800`}
      >
        <Icon n={done ? 'reopen' : 'check'} c="size-3.5" />
        {done ? 'Reopen' : 'Resolve'}
      </button>
      {replying ? null : (
        <button
          onClick={() => on.reply(t.tk)}
          className={`${HIT} -mx-1.5 flex h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 aria-pressed:underline dark:text-blue-400 dark:hover:bg-blue-400/10`}
        >
          <Icon n="reply" c="size-3.5" />
          Reply
        </button>
      )}
    </div>
  )
}

/** A comment not sent yet, where it will go: its words in the box, and its voice notes. */
export function DraftCard({ words, voice, transcribing }: { words: string; voice: number; transcribing: boolean }) {
  return (
    <div className="space-y-1 rounded-xl border border-dashed border-amber-400 bg-amber-50/70 p-3 text-sm dark:border-amber-500/60 dark:bg-amber-400/10">
      <div className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">Not sent</div>
      {words ? <div className="whitespace-pre-wrap">{words}</div> : null}
      {voice ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{transcribing ? 'Transcribing…' : plural(voice, 'voice note')}</div> : null}
    </div>
  )
}
