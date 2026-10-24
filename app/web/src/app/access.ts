// Taska wants its key (from outside this computer's network): it is asked for once, in the page, which stays where
// it was; signed in, what was waiting loads.

import { KeyNeeded, Refused } from '../api/http'
import type { TaskaApi } from '../api/taska'
import type { Sheets } from './sheets'
import type { Toasts } from './toasts'

export interface AccessDeps {
  api: TaskaApi
  sheets: Sheets
  toasts: Toasts
  /** load again what is shown */
  refresh(): void
}

export class Access {
  private readonly d: AccessDeps
  private asking = false
  constructor(d: AccessDeps) {
    this.d = d
  }

  /** The server wants the key: its sign-in shows (once). */
  ask(): void {
    if (this.asking) return
    this.asking = true
    this.d.sheets.open({ kind: 'sign-in' }, { focus: true })
  }

  /** -> signed in */
  async signIn(key: string): Promise<boolean> {
    try {
      const d = await this.d.api.login(key)
      if (!d.ok) throw new Refused(d.error || 'Invalid key')
    } catch (ex) {
      this.d.toasts.show(ex instanceof KeyNeeded ? 'That key is not right.' : ex instanceof Refused ? ex.message || 'Invalid key' : (ex as Error).message || 'Invalid key', null, { error: true })
      return false
    }
    this.asking = false
    this.d.sheets.close()
    this.d.toasts.show('Signed in')
    this.d.refresh()
    return true
  }
}
