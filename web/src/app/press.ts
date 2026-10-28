// Press feedback: what you press shows it for at least 130 ms (a quick tap too), as data-pressed on the element, which
// the elements' own classes style. Only looks: no action goes through here.

const PRESSABLE = 'button, a[href], summary, [role=button], [data-pressable]'

export function installPressFeedback(root: Document = document): () => void {
  let el: HTMLElement | null = null
  let t0 = 0
  let off = 0
  const end = (tap: boolean) => {
    const was = el
    if (!was) return
    clearTimeout(off)
    const go = () => {
      was.removeAttribute('data-pressed')
      if (el === was) el = null
    }
    const left = tap ? 130 - (performance.now() - t0) : 0
    if (left > 0) off = window.setTimeout(go, left)
    else go()
  }
  const down = (e: PointerEvent) => {
    const target = (e.target as Element).closest?.<HTMLElement>(PRESSABLE)
    if (!target) return
    clearTimeout(off)
    if (el && el !== target) el.removeAttribute('data-pressed')
    el = target
    t0 = performance.now()
    target.setAttribute('data-pressed', '')
  }
  const up = () => end(true)
  const cancel = () => end(false)
  root.addEventListener('pointerdown', down, true)
  root.addEventListener('pointerup', up, true)
  root.addEventListener('pointercancel', cancel, true)
  root.addEventListener('scroll', cancel, true)
  return () => {
    root.removeEventListener('pointerdown', down, true)
    root.removeEventListener('pointerup', up, true)
    root.removeEventListener('pointercancel', cancel, true)
    root.removeEventListener('scroll', cancel, true)
  }
}
