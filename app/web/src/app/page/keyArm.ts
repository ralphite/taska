// S, P or T, then the key that says what to set (a status's digit, a priority's, a type's letter), within 3 seconds.

export type ArmKey = 's' | 'p' | 't'

export class KeyArm {
  private armed: { k: ArmKey; n: number; t: number } | null = null

  set(k: ArmKey, n: number): void {
    this.armed = { k, n, t: Date.now() }
  }

  /** The field armed for item `n`, once (null: none, or too long ago). */
  take(n: number): ArmKey | null {
    const a = this.armed
    this.armed = null
    return a && a.n === n && Date.now() - a.t <= 3000 ? a.k : null
  }
}
