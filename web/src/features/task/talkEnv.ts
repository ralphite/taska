// What every part of a task's talk draws with, and what it can do: given by the task page's container.

import type { FileEvents, PlayState } from '../../ui/Files'
import type { Choosing } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'

export interface TalkEnv {
  world: InlineWorld
  /** the time the talk's times are told against */
  now: number
  desk: boolean
  /** voice notes' words are tidied (their original words can be seen) */
  tidy: boolean
  play(src: string): PlayState
  url(fid: string): string
  /** the messages opened whole (Show all) */
  opened: ReadonlySet<number>
  /** the task's latest message from anyone but the organizer: shown whole */
  latest: number | null
  /** picking the choices of the task's open question */
  choosing: Choosing | null
}

export interface TalkEvents extends FileEvents {
  ref(code: string): void
  picture(fid: string, all: string[]): void
  /** a long message opened or closed */
  more(id: number): void
}

export type { Choosing }
