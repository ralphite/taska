// A voice note's words, the one way every place waits for them: voice notes, dictation and search (T806 #7). Taska
// works them out and tries a failed one again itself (its pauses, and after a restart too), so an answer that is no
// longer waiting is final: failed means failed, everywhere. The page asks again only while Taska still works on them
// (each ask is answered within 45 s) or is out of reach (delivery).

import type { TaskaApi } from '../../api/taska'

export type Words = Awaited<ReturnType<TaskaApi['words']>>

/** How many times a page asks before it gives up on words that never came (about 15 minutes). */
export const ASKS = 20

/** The note's answer once it is in (`settled`: by default, no longer waiting); `ask`: one ask, which may wait. ->
 * the last answer: still waiting after all the asks, it never came. */
export async function wordsOf(ask: () => Promise<Words>, settled: (w: Words) => boolean = (w) => w.state !== 'wait', asks = ASKS): Promise<Words> {
  let w = await ask()
  for (let n = 1; n < asks && !settled(w); n++) w = await ask()
  return w
}

/** Taska does not have the note (gone after a restart before it was kept): it goes up again. */
export const lost = (w: Words) => w.tr_error === 'no such voice note'
