// The bar on selected words: speak a comment about them (the bar becomes its recording strip, where it is: ✕, ✓ and
// ↑, as on any place picked to comment on, B498), comment on them (a document's words), correct them (a voice note's
// words). It sits under the words, or over them when there is no room below; a
// press on it keeps the selection. Props only.

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon } from '../../ui/Icon'
import { PlaceVoice, PlaceVoiceRow } from '../../ui/PlaceVoice'

export interface Box {
  top: number
  bottom: number
  left: number
  width: number
  height: number
}

export function SelectionBar({ at, recording, desk = true, meter, comment, fix, on }: {
  /** where the words are on the screen; none: the bar is not there */
  at: Box | null
  /** a voice comment about them records: the bar is its recording strip */
  recording: boolean
  /** the strip's size: the desktop's, or the phone's (for a thumb) */
  desk?: boolean
  /** the recording's time and level */
  meter?: ReactNode
  /** Comment: words of a document */
  comment: boolean
  /** Correct: words of a voice note */
  fix: boolean
  on: { mic(): void; comment(): void; fix(): void; cancel(): void; check(): void; send(): void }
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar || !at) return
    const below = at.bottom + 8 + bar.offsetHeight < innerHeight - 8
    bar.style.top = `${below ? at.bottom + 8 : Math.max(8, at.top - bar.offsetHeight - 8)}px`
    bar.style.left = `${Math.max(8, Math.min(innerWidth - bar.offsetWidth - 8, at.left + at.width / 2 - bar.offsetWidth / 2))}px`
  })
  const keep = { onPointerDown: (e: { preventDefault(): void }) => e.preventDefault(), onMouseDown: (e: { preventDefault(): void }) => e.preventDefault() }
  if (recording) {
    const strip = { cancel: on.cancel, check: on.check, send: on.send, say: on.mic, comment: on.comment }
    return (
      <div ref={ref} hidden={!at} aria-label="On the selected text" data-selection-bar {...keep} className="fixed z-[65]">
        {desk ? (
          <PlaceVoice rec meter={meter} on={strip} />
        ) : (
          <div className="w-[min(22rem,calc(100vw-1rem))] rounded-full bg-white px-1 shadow-lg ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
            <PlaceVoiceRow rec meter={meter} on={strip} />
          </div>
        )}
      </div>
    )
  }
  return (
    <div
      ref={ref}
      hidden={!at}
      role="toolbar"
      aria-label="On the selected text"
      data-selection-bar
      {...keep}
      className="fixed z-[65] flex rounded-full bg-zinc-900 p-1 shadow-lg ring-1 ring-black/10 dark:bg-zinc-100 dark:ring-white/10"
    >
      <button
        onClick={on.mic}
        aria-label="Record comment on selection"
        title="Voice comment"
        className="grid size-11 place-items-center rounded-full text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"
      >
        <Icon n="mic" c="size-5" />
      </button>
      <button
        onClick={on.comment}
        hidden={!comment}
        aria-label="Comment"
        title="Comment"
        className="grid size-9 place-items-center self-center rounded-full text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"
      >
        <Icon n="comment" c="size-4" />
      </button>
      <button
        onClick={on.fix}
        hidden={!fix}
        aria-label="Correct the words"
        className="flex h-9 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"
      >
        <Icon n="pencil" c="size-4" />
        Correct
      </button>
    </div>
  )
}
