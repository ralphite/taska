// A message's words. A long one shows on the desktop whole up to a height (a fade says there is more, Show all opens
// it), on the phone its first line (Show more); the item's latest message is what you came to read: only past 50
// lines is it cut. Props only.

import type { Message } from '../../model/types'
import { Rich } from '../../ui/Markdown'
import type { TalkEnv, TalkEvents } from './talkEnv'

/** A message is folded (Show more, Show all) only past this many lines as it reads (F692, r1113). */
export const FOLD_FROM = 20

/** About how many lines the words take as they read: a long line wraps (a wide character, as in Chinese, takes the
 * room of two letters; the desktop's talk fits about 110 letters a line, the phone's about 44). */
export function shownLines(text: string, desk: boolean): number {
  const room = desk ? 110 : 44
  return text
    .trim()
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil([...line].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? 2 : 1), 0) / room)), 0)
}

export function MsgText({ x, env, on, done = null, whole = false }: {
  x: Message
  env: TalkEnv
  on: TalkEvents
  done?: readonly string[] | null
  whole?: boolean
}) {
  const latest = whole || env.latest === x.id
  // F692 (r1113): folded only from 20 lines as it reads (the latest message from 50)
  const long = (x.by !== 'you' || env.desk) && x.kind !== 'ask' && shownLines(x.text, env.desk) > (latest ? 50 : FOLD_FROM)
  const open = env.opened.has(x.id)
  const rich = (text: string) => <Rich text={text} world={env.world} done={done} onRef={on.ref} onPicture={on.picture} />
  if (long && env.desk && !open)
    return (
      <>
        <div onClick={() => on.more(x.id)} className="max-h-48 cursor-pointer overflow-hidden mask-b-from-60%">
          {rich(x.text)}
        </div>
        <button data-more onClick={() => on.more(x.id)} className="-mb-2 flex h-9 items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Show all
        </button>
      </>
    )
  const folded = long && !env.desk && !open
  const body = rich(folded ? x.text.trim().split('\n')[0] : x.text)
  if (!long) return body
  return (
    <>
      <div onClick={() => on.more(x.id)} className="cursor-pointer">
        {body}
      </div>
      <button data-more onClick={() => on.more(x.id)} className="-mb-2 flex h-11 items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
        {folded ? 'Show more' : 'Show less'}
      </button>
    </>
  )
}
