// How tall each item's row in the list is now: a row you act on is held in place at that height while the list
// stands still. The list gives its rows' elements by ref; nothing looks the page up.

export class RowSizes {
  private rows = new Map<number, HTMLElement>()
  private refs = new Map<number, (el: HTMLElement | null) => void>()

  /** The ref for item n's row (the same function each time, so React does not detach and attach it again). */
  ref = (n: number): ((el: HTMLElement | null) => void) => {
    let r = this.refs.get(n)
    if (!r) {
      let mine: HTMLElement | null = null
      r = (el) => {
        if (el) this.rows.set(n, (mine = el))
        else if (this.rows.get(n) === mine) this.rows.delete(n)
      }
      this.refs.set(n, r)
    }
    return r
  }

  /** The row's height in px, 0 when it is not in the list. */
  height(n: number): number {
    const el = this.rows.get(n)
    return el?.isConnected ? el.offsetHeight : 0
  }
}
