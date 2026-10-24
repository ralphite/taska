// The helper that runs inside a web-page document (its own sandbox: the page's scripts cannot reach Taska). It tells
// Taska the page's height, the part under the pointer or tapped, and where the parts with comments are; Taska tells it
// whether pointing outlines parts (or a tap picks one), which parts to find, the one picked, and whether a click only
// closes the open comments. A part is the nearest block around what you point at; its key is its place in the page:
// from the nearest element (itself or around it) the page names by an id, a data-part or a data-id no other element
// has (a card the page's own script moves or draws again keeps its comments), else from the page's body.

export const PAGE_HELPER = String.raw`<script>(() => {
  const send = (m) => parent.postMessage(Object.assign({ taskaPage: 1 }, m), '*')
  let mode = false, keys = [], picked = '', shut = false, shutting = false
  const named = (e) => {
    for (const a of ['id', 'data-part', 'data-id']) {
      const v = e.getAttribute(a)
      if (!v || !/^[A-Za-z0-9][\w:.-]{0,79}$/.test(v)) continue
      const s = '[' + a + "='" + v + "']"
      if (document.querySelectorAll(s).length === 1) return s
    }
    return ''
  }
  const place = (el) => {
    const p = []
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const n = named(e)
      if (n) return 'h:' + [n, ...p].join('>')
      let i = 1, s = e
      while ((s = s.previousElementSibling)) i++
      p.unshift(e.tagName.toLowerCase() + ':nth-child(' + i + ')')
    }
    return 'h:body>' + p.join('>')
  }
  const part = (el) => {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.nodeType !== 1) continue
      const r = el.getBoundingClientRect()
      if (r.width > 40 && r.height > 14 && getComputedStyle(el).display !== 'inline') return el
    }
    return null
  }
  const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })
  // a part that has comments already keeps the key they are under, whichever way it was made
  const keyOf = (el) => {
    for (const k of keys) {
      try { if (document.querySelector(k.slice(2)) === el) return k } catch (_) {}
    }
    return place(el)
  }
  const info = (el) => ({ key: keyOf(el), text: (el.innerText || '').trim().slice(0, 500), rect: box(el.getBoundingClientRect()) })
  // r672: the page's height, not its window's: a page as tall as its window (100vh, as apps are) keeps the height it
  // was given, instead of growing with its frame without end
  let tall = 0
  const size = () => {
    const e = document.documentElement
    const h = e.scrollHeight > e.clientHeight + 1 ? e.scrollHeight : Math.ceil(e.getBoundingClientRect().height)
    if (h !== tall) send({ h: (tall = h) })
  }
  // r799: where the parts with comments are now; a part hidden or gone has no place (its count is not drawn)
  let said = ''
  const measure = () => {
    const out = {}
    for (const k of keys) {
      try {
        const e = document.querySelector(k.slice(2))
        if (e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden') out[k] = box(e.getBoundingClientRect())
      } catch (_) {}
    }
    const s = JSON.stringify(out)
    if (s !== said) send({ rects: JSON.parse((said = s)) })
  }
  addEventListener('message', (e) => {
    const m = e.data || {}
    if (!m.taska) return
    mode = m.mode
    keys = m.keys || []
    picked = m.picked || ''
    shut = !!m.shut
    said = '' // Taska asks again: it is told again
    measure()
  })
  // B497: once a part is picked, no other one lights or can be picked until Esc lets it go
  addEventListener('mousemove', (e) => { if (mode === true && !picked) { const el = part(e.target); send({ hover: el ? info(el) : null, at: [e.clientX, e.clientY] }) } })
  document.addEventListener('mouseleave', () => { if (mode === true) send({ hover: null }) })
  // B502: a drag selects words (and only that); a click where the pointer went down picks the part
  let down = [0, 0]
  addEventListener('mousedown', (e) => { down = [e.clientX, e.clientY] }, true)
  addEventListener('click', (e) => {
    if (mode !== true && mode !== 'tap') {
      // Comment mode may be on in Taska before the page has heard: Taska decides (the click itself goes on)
      if (!shutting && Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) <= 4) { const el = part(e.target); if (el) send({ maybe: info(el) }) }
      return
    }
    // B497: nothing else is picked while one part is; B503: a click that closes open comments only closes them
    if ((mode === true && picked) || shutting) { e.preventDefault(); e.stopPropagation(); return }
    if (Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 4) return
    // r672: on the phone a tap on one of the page's own controls (a button, a link, a field) works it, as in any
    // page; a tap anywhere else picks the part (D50 #7)
    if (mode === 'tap' && e.target.closest && e.target.closest('a[href], button, input, select, textarea, label, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [contenteditable], [onclick]')) return
    getSelection().removeAllRanges()
    const el = part(e.target)
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    send({ pick: info(el) })
  }, true)
  addEventListener('keydown', (e) => { if (e.key === 'Escape') send({ esc: 1 }) })
  let usedAt = 0 // F449: Taska does not reload under you while you use the page
  let pointer = ''
  const used = (e) => {
    if (e.type === 'pointermove') { if (e.screenX + ',' + e.screenY === pointer) return; pointer = e.screenX + ',' + e.screenY }
    const n = Date.now(); if (n - usedAt > 10000) { usedAt = n; send({ used: 1 }) }
  }
  for (const t of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'input']) addEventListener(t, used, true)
  // B503: a click in the page closes open comments, and does nothing else (whatever Taska says meanwhile)
  addEventListener('pointerdown', () => { shutting = shut; send({ down: 1 }) }, true)
  // r799, r672: the page changes itself (its script shows another view, moves a card, adds a line): the counts and
  // outlines follow at the next frame
  let soon = 0
  const again = () => { if (!soon) soon = requestAnimationFrame(() => { soon = 0; size(); measure() }) }
  new ResizeObserver(again).observe(document.documentElement)
  new MutationObserver(again).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
  for (const t of ['load', 'transitionend', 'animationend', 'scroll']) addEventListener(t, again, true)
  size()
  send({ ready: 1 }) // Taska answers with what it needs from the page
})()</script>`
