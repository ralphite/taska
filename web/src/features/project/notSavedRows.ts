// What the Not saved sheet lists, from what the page could not save: what and why, when (against the time the
// project's news last came), where it belongs, and which project when it is another's. Pure: the container and the
// stories both use it.

import { when } from '../../model/time'
import type { NotSaved } from '../../stores/feedback'
import type { NotSavedRow } from './NotSaved'

export const notSavedRows = (list: readonly NotSaved[], here: string | null, title: (slug: string) => string, now: number | undefined): NotSavedRow[] =>
  list.map((f) => ({
    sid: f.sid,
    what: f.what,
    why: f.why,
    when: when(f.at, now ?? f.at),
    go: f.go,
    said: f.said,
    elsewhere: here != null && f.slug !== here ? title(f.slug) : undefined,
    canRetry: !!f.retry,
  }))
