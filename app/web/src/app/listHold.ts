// When the rows you acted on let go: a row holds still while the pointer is over the list (or for 3 s after a key or a
// finger's tap), so the next row never slides under a second click; then the list rearranges. On the desktop, a
// change made in the item pane waits until you go on to another item, or the pointer has been over the list and
// leaves it.

import type { UiStore } from '../stores/ui'

export class ListHold {
  private inList = false
  private until = 0
  private timer = 0
  private readonly ui: UiStore
  private readonly desk: () => boolean
  constructor(ui: UiStore, desk: () => boolean) {
    this.ui = ui
    this.desk = desk
  }

  /** A row began holding. */
  started(): void {
    this.until = Date.now() + (this.inList ? 800 : 3000)
    clearTimeout(this.timer)
    if (this.desk() && !this.inList) return
    this.timer = window.setTimeout(() => this.release(), this.until - Date.now())
  }

  release(): void {
    if (!this.ui.getState().held.size) return
    if (this.inList && Date.now() < this.until + 60000) return // still over the list: wait until it leaves
    this.ui.getState().release()
  }

  enter(): void {
    this.inList = true
  }

  leave(): void {
    this.inList = false
    if (this.ui.getState().held.size) {
      clearTimeout(this.timer)
      this.timer = window.setTimeout(() => this.release(), Math.max(0, this.until - Date.now()))
    }
  }
}
