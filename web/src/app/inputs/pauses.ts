// The pauses between tries of something that has to reach Taska (a voice note or a file going up): each grows
// (2, 4, 8, 16, then 30 s) and all of them end at once when Taska may be there again (the network is back, the window
// shows again, Taska answered), so what waited goes within moments rather than at the end of its pause.

export class Pauses {
  private readonly waiting = new Set<() => void>()

  /** The pause before try `n + 1` (n tries failed so far, counting from 0). */
  static after(n: number): number {
    return Math.min(30000, 2000 * 2 ** Math.min(n, 4))
  }

  /** Resolves after `ms`, or sooner when `wake` is called. */
  wait(ms: number): Promise<void> {
    return new Promise((ok) => {
      const done = () => {
        clearTimeout(t)
        this.waiting.delete(done)
        ok()
      }
      const t = setTimeout(done, ms)
      this.waiting.add(done)
    })
  }

  /** Every pause ends now. */
  wake(): void {
    for (const done of [...this.waiting]) done()
  }
}
