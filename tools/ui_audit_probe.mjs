// The measuring half of the UI audit (T113): one function that runs inside a drawn story and returns the visible
// display problems it finds. It is self-contained (Playwright sends its source to the page), uses no model and no
// randomness, and returns the same findings for the same page.
//
// Kinds:
//   align     controls in one row whose vertical centres differ (a button lower than its neighbour)
//   height    controls of different heights in a toolbar, pill or button row that draws a frame around them
//   icon      a control's icon and its one-line label not centred on each other
//   wrap      a short control label that wraps onto a second line, so the control grows taller
//   midword   a short word broken across two lines (break-words in a box narrower than the word)
//   cut       text cut off by its box without an ellipsis
//   overflow  a phone frame (393 wide) that scrolls sideways, with the element that sticks out
//
// Rules that keep false positives out (from the manual review of the first audit, 11-06):
//   - story scaffolding is skipped: rows around the phone and desktop frames ([data-layout]) and their captions
//   - rows that align their items to the end or the baseline mean it (attachments of different sizes)
//   - a row with text on more than one line is a multi-line row: its controls sit at the top or the middle by design
//   - an icon over its label (a column) is not an icon beside its label
//   - text that ends in an ellipsis, fades out (mask) or scrolls is not cut off

export function probe() {
  const INTER = 'button,a[href],[role=button],[role=tab],[role=menuitem],[role=option],input,select,textarea,summary'
  const LABELLED = 'button,a[href],[role=button],[role=tab],[role=menuitem],[role=option],summary'
  const root = document.getElementById('storybook-root') || document.body
  const out = []
  const styles = new Map()
  const st = (el) => {
    let s = styles.get(el)
    if (!s) styles.set(el, (s = getComputedStyle(el)))
    return s
  }
  const visCache = new Map()
  const vis = (el) => {
    if (visCache.has(el)) return visCache.get(el)
    const r = el.getBoundingClientRect()
    let ok = r.width >= 1 && r.height >= 1
    if (ok) {
      const cs = st(el)
      if (cs.visibility !== 'visible' || parseFloat(cs.opacity) === 0) ok = false
    }
    if (ok && el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement
      if (!vis(p)) ok = false
      else {
        // clipped away by an ancestor that hides what leaves it
        for (let q = p; q && q !== document.body; q = q.parentElement) {
          const qc = st(q)
          if (qc.overflowX !== 'visible' || qc.overflowY !== 'visible') {
            const qr = q.getBoundingClientRect()
            if (r.bottom <= qr.top + 1 || r.top >= qr.bottom - 1 || r.right <= qr.left + 1 || r.left >= qr.right - 1) ok = false
            break
          }
        }
      }
    }
    visCache.set(el, ok)
    return ok
  }
  const cls = (el) => (el.getAttribute('class') || '').replace(/\s+/g, ' ').trim()
  const sigOf = (el) => (el.tagName.toLowerCase() + '.' + cls(el)).slice(0, 240)
  const layoutOf = (el) => el.closest('[data-layout]')?.getAttribute('data-layout') || 'none'
  const scaffold = (el) => !!el.querySelector('[data-layout]') || !!el.closest('figcaption')
  let id = 0
  const mark = (el) => {
    if (!el.dataset.uiAudit) el.dataset.uiAudit = String(++id)
    return el.dataset.uiAudit
  }
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  }
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)
  const push = (kind, el, sig, detail) => out.push({ kind, sig: kind + '|' + sig, detail, layout: layoutOf(el), label: label(el), mark: mark(el), box: box(el) })

  // The visible text of a node: its text nodes, the line boxes each is drawn on (rects grouped by their top)
  const textVisible = (t) => {
    const p = t.parentElement
    if (!p || !vis(p)) return false
    const r = p.getBoundingClientRect()
    return r.width > 2 && r.height > 2
  }
  const lineTops = (range) => {
    const tops = []
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue
      if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top)
    }
    return tops
  }
  const texts = (el, skipNested) => {
    const list = []
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode())) {
      if (!n.textContent.trim() || !textVisible(n)) continue
      if (skipNested && n.parentElement.closest(INTER) !== el) continue
      list.push(n)
    }
    return list
  }
  const rangeOf = (n, a = 0, b = n.textContent.length) => {
    const g = document.createRange()
    g.setStart(n, a)
    g.setEnd(n, b)
    return g
  }
  // how many lines the text inside `el` takes (its text nodes' line boxes, together)
  const lineCount = (el) => {
    const tops = []
    for (const n of texts(el, false)) for (const t of lineTops(rangeOf(n))) if (!tops.some((x) => Math.abs(x - t) < 6)) tops.push(t)
    return tops.length
  }
  const clear = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c)
  const boxDrawn = (el) => {
    const s = st(el)
    return !clear(s.backgroundColor) || (parseFloat(s.borderTopWidth) > 0 && !clear(s.borderTopColor)) || s.boxShadow !== 'none'
  }
  const controlOf = (child) => {
    if (child.matches(INTER)) return child
    const inner = child.querySelectorAll(INTER)
    return inner.length === 1 ? inner[0] : null
  }

  // align, height: rows of controls (a wrapping row on two lines is two rows: what is compared overlaps vertically)
  const oneLine = (list) => Math.max(...list.map((k) => k.r.top)) < Math.min(...list.map((k) => k.r.bottom))
  const cy = (r) => r.top + r.height / 2
  // the first line of the text in `el`: where its letters are drawn, and the height of its line
  const firstLine = (el) => {
    for (const n of texts(el, false)) {
      const r = [...rangeOf(n).getClientRects()].find((x) => x.width > 0 && x.height > 0)
      if (r) return { top: r.top, height: r.height, lh: parseFloat(st(n.parentElement).lineHeight) || r.height * 1.25 }
    }
    return null
  }
  for (const row of root.querySelectorAll('*')) {
    const cs = st(row)
    if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue
    if (cs.flexDirection !== 'row' && cs.flexDirection !== 'row-reverse') continue
    if (!vis(row) || scaffold(row)) continue
    const shown = [...row.children].filter(vis)
    // height: boxes side by side (buttons, or chips holding them) whose heights differ a little, which reads as a
    // mistake (a picture beside a chip differs a lot, on purpose); in a pill or a toolbar any difference shows. Only
    // what draws its own box can look taller than its neighbours (a bare icon button cannot).
    const boxes = shown.filter((ch) => (ch.matches(INTER) || ch.querySelector(INTER)) && boxDrawn(ch)).map((ch) => ({ ch, r: ch.getBoundingClientRect() }))
    if (boxes.length >= 2 && oneLine(boxes)) {
      const hs = boxes.map((k) => k.r.height)
      const radius = parseFloat(cs.borderTopLeftRadius) || 0
      const pill = row.getAttribute('role') === 'toolbar' || row.hasAttribute('data-selection-bar') ||
        (boxDrawn(row) && radius >= row.getBoundingClientRect().height / 2 - 1)
      const near = hs.flatMap((a) => hs.map((b) => a - b)).filter((d) => d > 2 && (pill || d <= 12))
      const dh = near.length ? Math.max(...near) : 0
      if (dh) {
        push('height', row, sigOf(row) + ' >> ' + boxes.map((k) => sigOf(k.ch)).join(' | '), { px: +dh.toFixed(1), heights: hs.map((h) => +h.toFixed(1)) })
        continue
      }
    }
    // align: rows that align their items to the end or the baseline mean it
    if (/end|baseline/.test(cs.alignItems)) continue
    const kids = []
    for (const ch of shown) {
      const c = controlOf(ch)
      if (c && vis(c) && c.getBoundingClientRect().height > 12) kids.push({ c, ch, r: c.getBoundingClientRect() })
    }
    if (!kids.length || !oneLine(kids)) continue
    const sig = sigOf(row) + ' >> ' + kids.map((k) => sigOf(k.ch)).join(' | ')
    const multi = shown.filter((ch) => lineCount(ch) > 1)
    if (!multi.length) {
      if (kids.length < 2) continue
      const dy = Math.max(...kids.map((k) => cy(k.r))) - Math.min(...kids.map((k) => cy(k.r)))
      if (dy > 1.5) push('align', row, sig, { px: +dy.toFixed(1), controls: kids.map((k) => label(k.c) || k.c.tagName.toLowerCase()) })
      continue
    }
    // a multi-line row: a small control set at the top sits on the text's first line (one centred on the row, or a
    // larger one, is placed on the whole row by design)
    const line = firstLine(multi[0])
    if (!line) continue
    for (const k of kids) {
      if (multi.includes(k.ch)) continue
      const self = st(k.ch).alignSelf
      if (!/start/.test(self === 'auto' ? cs.alignItems : self) || k.r.height >= line.lh * 1.5) continue
      const d = Math.abs(cy(k.r) - cy(line))
      if (d > 1.5) {
        push('align', row, sig, { px: +d.toFixed(1), controls: [label(k.c) || k.c.tagName.toLowerCase(), 'the first line of its text'] })
        break
      }
    }
  }

  // icon, wrap: inside one control
  for (const b of root.querySelectorAll(LABELLED)) {
    if (!vis(b) || scaffold(b)) continue
    const own = texts(b, true)
    const words = own.map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim()
    const lines = lineCount(b)
    // wrap: a short label (a button's, a tab's, a chip's) drawn on two lines
    if (words && words.length <= 32 && words.split(' ').length <= 5 && st(b).whiteSpace !== 'pre-wrap') {
      const broken = own.find((n) => lineTops(rangeOf(n)).length > 1)
      if (broken) push('wrap', b, sigOf(b), { text: broken.textContent.trim().slice(0, 40) })
    }
    const svgs = [...b.querySelectorAll(':scope > svg, :scope > span > svg')].filter(vis)
    if (svgs.length !== 1 || own.length !== 1 || lines !== 1) continue
    const s = svgs[0].getBoundingClientRect()
    const rects = [...rangeOf(own[0]).getClientRects()].filter((r) => r.width > 0)
    if (s.height < 8 || rects.length !== 1) continue
    const t = rects[0]
    // beside it, not over or under it
    if (Math.min(s.bottom, t.bottom) - Math.max(s.top, t.top) <= 0) continue
    if (!(t.left >= s.right - 1 || t.right <= s.left + 1)) continue
    const d = Math.abs(s.top + s.height / 2 - (t.top + t.height / 2))
    if (d > 1.5) push('icon', b, sigOf(b) + ' >> ' + sigOf(svgs[0]), { px: +d.toFixed(1) })
  }

  // midword, cut: text in any box
  const seen = new Set()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    const text = n.textContent
    if (!text.trim() || !textVisible(n)) continue
    const p = n.parentElement
    if (seen.has(p) || scaffold(p)) continue
    const cs = st(p)
    // midword: words of letters only (not links, codes or file names, which may break anywhere; nor Chinese or
    // Japanese, which break between any two characters)
    if (/break-word|anywhere/.test(cs.overflowWrap) || /break-all|break-word/.test(cs.wordBreak)) {
      if (lineTops(rangeOf(n)).length > 1) {
        // a word: between spaces, letters only, with at most ordinary punctuation around it
        const re = /\S+/g
        let m
        while ((m = re.exec(text))) {
          const w = /^[("'“‘]*([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]{2,20})[)"'”’.,;:!?]*$/u.exec(m[0])
          if (!w) continue
          const at = m.index + m[0].indexOf(w[1])
          if (lineTops(rangeOf(n, at, at + w[1].length)).length > 1) {
            seen.add(p)
            push('midword', p, sigOf(p), { word: w[1] })
            break
          }
        }
      }
    }
    // cut: the nearest box that hides what leaves it, when the text leaves it with no ellipsis or fade
    const tr = rangeOf(n).getBoundingClientRect()
    let fade = false
    for (let q = p; q && q !== document.body; q = q.parentElement) {
      const qc = st(q)
      if (qc.textOverflow === 'ellipsis' || (qc.webkitLineClamp && qc.webkitLineClamp !== 'none')) break
      if (qc.maskImage && qc.maskImage !== 'none') fade = true
      if (qc.overflowX === 'visible' && qc.overflowY === 'visible') continue
      if (fade || q.hasAttribute('data-layout')) break
      const qr = q.getBoundingClientRect()
      const sideways = qc.overflowX !== 'auto' && qc.overflowX !== 'scroll' && (tr.right > qr.right + 1 || tr.left < qr.left - 1)
      const down = qc.overflowY !== 'auto' && qc.overflowY !== 'scroll' && qr.height < 100 && (tr.bottom > qr.bottom + 1 || tr.top < qr.top - 1)
      // partly shown: some of it inside the box
      const inside = tr.right > qr.left && tr.left < qr.right && tr.bottom > qr.top && tr.top < qr.bottom
      if ((sideways || down) && inside) {
        seen.add(p)
        push('cut', p, sigOf(p) + ' in ' + sigOf(q), { text: text.trim().slice(0, 40), by: sideways ? Math.round(Math.max(tr.right - qr.right, qr.left - tr.left)) : Math.round(Math.max(tr.bottom - qr.bottom, qr.top - tr.top)) })
      }
      break
    }
  }

  // overflow: the phone scrolls sideways
  for (const frame of root.querySelectorAll('[data-layout=phone]')) {
    if (!vis(frame) || frame.scrollWidth <= frame.clientWidth + 1) continue
    const fr = frame.getBoundingClientRect()
    const right = fr.left + frame.clientWidth
    // the outermost elements that stick out and that nothing between them and the frame clips
    let culprit = null
    const stack = [...frame.children]
    while (stack.length && !culprit) {
      const el = stack.shift()
      const r = el.getBoundingClientRect()
      if (r.width >= 1 && r.right > right + 1 && st(el).position !== 'fixed') {
        culprit = el
        break
      }
      const ec = st(el)
      if (ec.overflowX === 'visible' && ec.overflowY === 'visible') stack.push(...el.children)
    }
    const el = culprit || frame
    push('overflow', el, sigOf(el), { px: frame.scrollWidth - frame.clientWidth })
  }
  return out
}
