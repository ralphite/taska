// The page's few places the keys reach, given by ref where they are drawn: the list's search, the box, the talk that
// Space scrolls. Nothing looks the page up.

export type FieldName = 'search' | 'box' | 'talk'

export class Fields {
  private els = new Map<FieldName, HTMLElement>()
  private refs = new Map<FieldName, (el: HTMLElement | null) => void>()

  /** The ref for a place (the same function each time). */
  ref(name: FieldName): (el: HTMLElement | null) => void {
    let r = this.refs.get(name)
    if (!r) {
      r = (el) => {
        if (el) this.els.set(name, el)
        else this.els.delete(name)
      }
      this.refs.set(name, r)
    }
    return r
  }

  get(name: FieldName): HTMLElement | null {
    const el = this.els.get(name)
    return el?.isConnected ? el : null
  }

  focus(name: FieldName): void {
    this.get(name)?.focus()
  }

  /** whether the place is where the keys go now */
  focused(name: FieldName): boolean {
    const el = this.get(name)
    return !!el && el === el.ownerDocument.activeElement
  }
}
