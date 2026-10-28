// The bar on selected words: speak a comment about them (the same button stops it), comment on them (a document's
// words), correct them (a voice note's words). It sits under the words, or over them when there is no room below; a
// press on it keeps the selection. Props only.

import { useLayoutEffect, useRef } from 'react'
import { Icon } from '../../ui/Icon'

export interface Box {
  top: number
  bottom: number
  left: number
  width: number
  height: number
}

export function SelectionBar({ at, recording, comment, fix, on }: {
  /** where the words are on the screen; none: the bar is not there */
  at: Box | null
  recording: boolean
  /** Comment: words of a document */
  comment: boolean
  /** Correct: words of a voice note */
  fix: boolean
  on: { mic(): void; comment(): void; fix(): void }
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar || !at) return
    const below = at.bottom + 8 + bar.offsetHeight < innerHeight - 8
    bar.style.top = `${below ? at.bottom + 8 : Math.max(8, at.top - bar.offsetHeight - 8)}px`
    bar.style.left = `${Math.max(8, Math.min(innerWidth - bar.offsetWidth - 8, at.left + at.width / 2 - bar.offsetWidth / 2))}px`
  })
  return (
    <div
      ref={ref}
      hidden={!at}
      role="toolbar"
      aria-label="On the selected text"
      data-selection-bar
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[65] flex rounded-full bg-zinc-900 p-1 shadow-lg ring-1 ring-black/10 dark:bg-zinc-100 dark:ring-white/10"
    >
      <button
        onClick={on.mic}
        {...(recording ? { 'data-on': '' } : {})}
        aria-label={recording ? 'Stop: the quote and the voice note go into the box' : 'Record comment on selection'}
        title={recording ? 'Stop' : 'Voice comment'}
        className="grid size-11 place-items-center rounded-full text-white hover:bg-white/15 data-on:bg-red-600 data-on:text-white dark:text-zinc-900 dark:hover:bg-zinc-900/10 dark:data-on:bg-red-600 dark:data-on:text-white"
      >
        {recording ? <span className="size-2.5 animate-pulse rounded-full bg-white" /> : <Icon n="mic" c="size-5" />}
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
