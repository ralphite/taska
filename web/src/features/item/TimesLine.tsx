// When an item was made and last changed, as its page says them under its chips (F704 r1157). Props only.

import { itemTimes } from '../../model/itemTimes'
import type { Item } from '../../model/types'
import { MUTED } from '../../ui/tones'

/** When it was made (by whom) and last changed, one quiet line under its chips (F704 r1157): on the phone a tap opens
 * both in full in a sheet; on the desktop the pointer shows them in the page's tip. */
export function TimesLine({ it, now, desk, onOpen }: { it: Pick<Item, 't0' | 't1' | 'by'>; now: number; desk: boolean; onOpen(): void }) {
  const x = itemTimes(it, now)
  const words = (
    <>
      {x.made}
      {x.updated ? (
        <>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
          {x.updated}
        </>
      ) : null}
    </>
  )
  const look = `self-start text-[13px] leading-5 ${MUTED}`
  return desk ? (
    <span data-part="item-times" title={x.tip} className={`cursor-default ${look}`}>
      {words}
    </span>
  ) : (
    <button data-part="item-times" onClick={onOpen} className={`-my-2 py-2 text-left ${look}`}>
      {words}
    </button>
  )
}
