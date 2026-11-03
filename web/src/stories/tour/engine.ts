// Which step a tour is on, when that step is done, when its part is missing (F566, D105): pure, from what the screen
// showed this frame. TourFrame looks at the screen once a frame and hands it here.
import type { Tour } from './tour'

/** Where a tour is: the step, since when, whether this step's `gone` part was seen, whether its `until` was judged
 * yet, and the steps already done when they began (a mistake in the tour: the automated check fails on them). */
export interface Run {
  i: number
  since: number
  saw: boolean
  judged: boolean
  skipped: number[]
}

/** What the screen showed this frame, for the step the tour is on. */
export interface Look {
  now: number
  /** its part is on the screen (a step that names none: true) */
  target: boolean
  /** the part its `until` names is there (and has its words) */
  subject: boolean
  /** its part was tapped since the last frame */
  tapped: boolean
  /** Next was tapped since the last frame */
  next: boolean
}

export const WAIT = 3000

export const begin = (now: number): Run => ({ i: 0, since: now, saw: false, judged: false, skipped: [] })

export const finished = (tour: Tour, run: Pick<Run, 'i'>) => run.i >= tour.steps.length

const waited = (tour: Tour, run: Run, now: number) => now - run.since >= (tour.steps[run.i]?.wait ?? WAIT)

/** The run after this frame: at most one step further (the same object when nothing changed). A step without `until`
 * is done when its part is tapped; one with `next` when Next is; one with `until` when the screen shows it, judged only
 * once its part is found or its wait is over (`gone`: its part was seen in this step and is gone now). An `until` met
 * the first time it is judged was done before the step began: it is noted in `skipped`. */
export function advance(tour: Tour, run: Run, look: Look): Run {
  const s = tour.steps[run.i]
  if (!s) return run
  const saw = run.saw || (!!s.until && 'gone' in s.until && look.subject)
  let done: boolean
  let judged = run.judged
  let skipped = run.skipped
  if (s.next) done = look.next
  else if (s.until) {
    if (!look.target && !waited(tour, run, look.now)) done = false
    else {
      done = 'gone' in s.until ? saw && !look.subject : look.subject
      if (!judged && done) skipped = [...skipped, run.i]
      judged = true
    }
  } else done = look.tapped
  if (done) return { i: run.i + 1, since: look.now, saw: false, judged: false, skipped }
  return saw === run.saw && judged === run.judged ? run : { ...run, saw, judged }
}

/** Its part is not on the screen though the step has waited for it. */
export const missing = (tour: Tour, run: Run, look: Pick<Look, 'now' | 'target'>) => {
  const s = tour.steps[run.i]
  return !!s?.target && !look.target && waited(tour, run, look.now)
}
