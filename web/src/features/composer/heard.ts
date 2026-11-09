// Where a voice note's words may be misheard in a draft now (worked out by the model, kept while the draft holds).

import { useMemo } from 'react'
import { openDoubts, spotsIn, toCheckOf } from '../../model/doubts'
import type { DraftFile } from '../../stores/box'

export function useHeard(text: string, files: readonly DraftFile[] | undefined) {
  return useMemo(() => {
    const fs = files || []
    const spots = spotsIn(text, fs)
    const open = openDoubts(text, fs)
    return { spots, open, toCheck: toCheckOf(spots), pickable: spots.some((p) => p.x.alt) }
  }, [text, files])
}
