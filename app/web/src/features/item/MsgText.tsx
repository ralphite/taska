// A message's words. A long one shows on the desktop whole up to a height (a fade says there is more, Show all opens
// it), on the phone its first line (Show more); the item's latest message is what you came to read: only past 50
// lines is it cut. Props only.

import type { Message } from '../../model/types'
import { Rich } from '../../ui/Markdown'
import type { TalkEnv, TalkEvents } from './talkEnv'

export function MsgText({ x, env, on, choosing = null, done = null, whole = false }: {
  x: Message
  env: TalkEnv
  on: TalkEvents
  choosing?: TalkEnv['choosing']
  done?: readonly string[] | null
  whole?: boolean
}) {
  const latest = whole || env.latest === x.id
  const lines = x.text.trim().split('\n').length
  const long = (x.by !== 'you' || env.desk) && x.kind !== 'ask' && (latest ? lines > 50 : x.text.length > 240 || lines > 3)
  const open = env.opened.has(x.id)
  const rich = (text: string) => <Rich text={text} world={env.world} choosing={choosing} done={done} onRef={on.ref} onPicture={on.picture} />
  if (long && env.desk && !open)
    return (
      <>
        <div onClick={() => on.more(x.id)} className="max-h-48 cursor-pointer overflow-hidden mask-b-from-60%">
          {rich(x.text)}
        </div>
        <button onClick={() => on.more(x.id)} className="-mb-2 flex h-9 items-center text-sm font-medium text-blue-600 dark:text-blue-400">
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
      <button onClick={() => on.more(x.id)} className="-mb-2 flex h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400">
        {folded ? 'Show more' : 'Show less'}
      </button>
    </>
  )
}
