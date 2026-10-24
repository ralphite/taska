// The items of the list in the order it shows them, given by the list as it draws: Previous and Next (J and K, the
// pane's arrows) walk them. The item you just settled and that left the list goes on from where it was.

export type Step = number | 'first' | 'last' | null

export class ListOrder {
  private now: readonly number[] = []
  /** the rows when the open item was last among them */
  private at: { n: number; rows: readonly number[] } | null = null

  /** The rows as the list shows them now. */
  rows(): readonly number[] {
    return this.now
  }

  set(rows: readonly number[], open: number | null): void {
    this.now = rows
    if (open != null && rows.includes(open)) this.at = { n: open, rows }
  }

  /** The item one step on from the open one; 'first' or 'last' when there is none that way. */
  step(open: number | null, dir: 1 | -1): Step {
    const now = this.now
    if (open != null && !now.includes(open) && this.at?.n === open) {
      const from = this.at.rows
      const i = from.indexOf(open)
      const next = (dir > 0 ? from.slice(i + 1) : from.slice(0, i).reverse()).find((k) => now.includes(k))
      if (next != null) return next
    }
    if (!now.length) return null
    const i = now.indexOf(open ?? -1)
    const n = now[i < 0 ? (dir > 0 ? 0 : now.length - 1) : Math.max(0, Math.min(now.length - 1, i + dir))]
    return n !== open ? n : dir < 0 ? 'first' : 'last'
  }
}
