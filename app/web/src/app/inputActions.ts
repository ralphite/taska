// What you do to something you said: organize it again (after the organizer failed, or after you undid what it
// filed), take back what it filed, delete or restore it. Each goes out as a change, sent again until Taska has it.

import { inputCode } from '../model/words'
import { newId, type ChangeRunner } from './changeRunner'

export class InputActions {
  private readonly runner: ChangeRunner
  constructor(runner: ChangeRunner) {
    this.runner = runner
  }

  private send(slug: string, op: Record<string, unknown>, said: string) {
    return this.runner.send({ id: newId(), slug, commands: [op as never], patches: [], said, t: Date.now() })
  }

  organizeAgain(slug: string, id: string): void {
    void this.send(slug, { op: 'organize-again', id }, `organizing ${inputCode(id)} again`)
  }
}
