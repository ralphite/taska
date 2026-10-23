// T457, R488: how a played page is touched, the same in every demo and prototype: a large mark comes where the finger
// lands, presses and ripples out, and the page gets the press as from a finger; a key shows as a key cap. The pace is
// a person's: look, move, tap, see what changed.
export const PACE = {
  start: 1500, // the first screen, before anything happens
  read: 1200, // the line is read before the step happens
  aim: 700, // the eye finds the spot before the finger lands
  press: 120,
  lift: 500,
  settle: 1700, // the page answered: time to see what changed
  letter: 110, // typing a letter; a Chinese character takes longer
  han: 300,
  agent: 2200, // an agent's words reach the page (it hears of them by itself)
  find: 8000, // the most a step waits for what it taps to show
}
const MARK = 64 // px: the tap mark, big enough to see at a glance on the phone

function overlay(doc: Document, id: string, css: Partial<CSSStyleDeclaration>) {
  let m = doc.getElementById(id)
  if (!m) {
    m = doc.createElement('div')
    m.id = id
    m.setAttribute('aria-hidden', 'true')
    Object.assign(m.style, { position: 'fixed', zIndex: '2147483647', pointerEvents: 'none', opacity: '0', ...css })
    doc.body.append(m)
  }
  return m
}

/** Bring it into sight, as a finger scrolls: up or down as little as needed; a chip in a strip that scrolls sideways
 * (the views) to the strip's middle, so it is never half under the strip's arrows. */
function inSight(el: HTMLElement) {
  const view = el.ownerDocument.defaultView
  for (let s = el.parentElement; s && view; s = s.parentElement) {
    const o = view.getComputedStyle(s).overflowX
    if ((o === 'auto' || o === 'scroll') && s.scrollWidth > s.clientWidth) {
      const r = el.getBoundingClientRect(),
        b = s.getBoundingClientRect()
      s.scrollLeft += r.left + r.width / 2 - (b.left + b.width / 2)
      break
    }
  }
  el.scrollIntoView({ block: 'nearest' })
}

/** The mark where the finger is. */
function fingerAt(doc: Document, x: number, y: number) {
  const m = overlay(doc, 'demoTap', {
    width: MARK + 'px',
    height: MARK + 'px',
    margin: `-${MARK / 2}px 0 0 -${MARK / 2}px`,
    borderRadius: '50%',
    background: 'rgba(37, 99, 235, 0.28)',
    border: '3px solid rgba(37, 99, 235, 0.9)',
    boxShadow: '0 0 0 6px rgba(255, 255, 255, 0.7)',
    transition: 'opacity 200ms ease, transform 160ms ease', // T456: where the finger lands, never sliding there
  })
  m.style.left = x + 'px'
  m.style.top = y + 'px'
  m.style.opacity = '1'
  return m
}

/** Touch this element (with a key held: "Meta" or "Shift", a desktop's Cmd-click or Shift-click). `mine`: Autoplay
 * is off, so the mark breathes there until it settles: true when you tapped here yourself, false when you tapped the
 * same step elsewhere and this one follows. */
export async function touch(
  el: HTMLElement,
  pause: (ms: number) => Promise<void>,
  mine?: Promise<boolean>,
  hold?: 'Meta' | 'Shift',
) {
  const doc = el.ownerDocument,
    win = doc.defaultView as Window & typeof globalThis
  inSight(el)
  const r = el.getBoundingClientRect(),
    at = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 },
    m = fingerAt(doc, at.clientX, at.clientY)
  if (mine) {
    const breathe = m.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
      duration: 1400,
      iterations: Infinity,
    })
    const yours = await mine
    breathe.cancel()
    if (yours) {
      m.style.opacity = '0'
      return
    }
  } else await pause(PACE.aim)
  m.style.transform = 'scale(0.82)'
  const ring = m.cloneNode() as HTMLElement // the press ripples out from under the finger
  ring.removeAttribute('id')
  m.after(ring)
  ring.animate(
    [
      { transform: 'scale(0.8)', opacity: 0.9 },
      { transform: 'scale(2.2)', opacity: 0 },
    ],
    { duration: 600, easing: 'ease-out' },
  ).onfinish = () => ring.remove()
  el.dispatchEvent(new win.PointerEvent('pointerdown', { ...at, pointerType: 'touch' }))
  await pause(PACE.press)
  el.dispatchEvent(new win.PointerEvent('pointerup', { ...at, pointerType: 'touch' }))
  if (hold)
    el.dispatchEvent(new win.MouseEvent('click', { ...at, metaKey: hold === 'Meta', shiftKey: hold === 'Shift' }))
  else el.click()
  if (el.matches('input, textarea, select')) el.focus() // a field you tap is the one you type in
  m.style.transform = 'scale(1)'
  await pause(PACE.lift)
  m.style.opacity = '0'
}

/** You tap this element yourself (resolves true when you did). */
export const yourTap = (el: HTMLElement) =>
  new Promise<boolean>((ok) =>
    el.addEventListener('click', (e) => e.isTrusted && ok(true), { once: true, capture: true }),
  )

const KEY_NAMES: Record<string, string> = { Meta: '⌘', Shift: '⇧', Enter: '↵', Escape: 'Esc' }
/** Press a key or a chord ("Meta+k", "Shift+Enter") where the page has its focus; its name shows as a key cap. */
export async function press(doc: Document, chord: string, pause: (ms: number) => Promise<void>) {
  const win = doc.defaultView as Window & typeof globalThis,
    parts = chord.split('+'),
    key = parts.pop() || '',
    cap = overlay(doc, 'demoKey', {
      left: '50%',
      bottom: '96px',
      transform: 'translateX(-50%)',
      padding: '10px 18px',
      borderRadius: '12px',
      background: 'rgba(24, 24, 27, 0.92)',
      color: 'white',
      font: '600 22px/1 ui-sans-serif, system-ui',
      boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.7)',
      transition: 'opacity 200ms ease',
    })
  cap.textContent = [...parts, key].map((k) => KEY_NAMES[k] || (k.length === 1 ? k.toUpperCase() : k)).join(' ')
  cap.style.opacity = '1'
  await pause(PACE.aim)
  const o = { key, bubbles: true, cancelable: true, metaKey: parts.includes('Meta'), shiftKey: parts.includes('Shift') }
  const to = (doc.activeElement as HTMLElement | null) || doc.body
  to.dispatchEvent(new win.KeyboardEvent('keydown', o))
  to.dispatchEvent(new win.KeyboardEvent('keyup', o))
  await pause(PACE.lift)
  cap.style.opacity = '0'
}

/** Type words, letter by letter, into this field (the box when none is given): false when it is not there. */
export async function typeIn(
  doc: Document,
  words: string,
  pause: (ms: number) => Promise<void>,
  field: Element | null = doc.querySelector('#text'),
) {
  const win = doc.defaultView as Window & typeof globalThis
  if (!(field instanceof win.HTMLInputElement || field instanceof win.HTMLTextAreaElement)) return false
  field.focus()
  // the field's own setter, as the browser sets it when you type: a field the page keeps in step sees the change
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set
  for (const ch of words) {
    set?.call(field, field.value + ch)
    field.dispatchEvent(new win.Event('input', { bubbles: true }))
    await pause(/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? PACE.han : PACE.letter)
  }
  return true
}

/** Paste a file into the box, as from the clipboard (a screenshot): the page takes it as it takes yours. */
export async function pasteIn(doc: Document, url: string) {
  const win = doc.defaultView as Window & typeof globalThis,
    t = doc.querySelector<HTMLTextAreaElement>('#text'),
    blob = await (await fetch(url)).blob()
  if (!t) return false
  const dt = new win.DataTransfer()
  dt.items.add(new win.File([blob], url.split('__').pop() || 'image.png', { type: blob.type }))
  t.focus()
  t.dispatchEvent(new win.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  return true
}

/** Swipe across this element, this far (px: right when more than 0), the finger's mark going along. From its edge
 * when it is the whole page (the phone's swipe back starts at the left edge of the screen). */
export async function swipe(el: HTMLElement, by: number, pause: (ms: number) => Promise<void>) {
  const doc = el.ownerDocument,
    win = doc.defaultView as Window & typeof globalThis
  inSight(el)
  const r = el.getBoundingClientRect(),
    y = r.top + Math.min(r.height / 2, 120),
    x0 = by > 0 ? r.left + 40 : r.right - 40,
    m = fingerAt(doc, x0, y)
  await pause(PACE.aim)
  m.style.transition = 'opacity 200ms ease'
  const t = (x: number) => new win.Touch({ identifier: 1, target: el, clientX: x, clientY: y })
  const send = (type: string, x: number, on = true) =>
    el.dispatchEvent(
      new win.TouchEvent(type, {
        touches: on ? [t(x)] : [],
        targetTouches: on ? [t(x)] : [],
        changedTouches: [t(x)],
        bubbles: true,
        cancelable: true,
      }),
    )
  send('touchstart', x0)
  for (let k = 1; k <= 14; k++) {
    const x = x0 + (by * k) / 14
    m.style.left = x + 'px'
    send('touchmove', x)
    await pause(28)
  }
  send('touchend', x0 + by, false)
  await pause(PACE.lift)
  m.style.opacity = '0'
}
