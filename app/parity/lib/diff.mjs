// What differs between two captures: pixels (anti-aliasing ignored, as pixelmatch does), and lines of text.
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

// How far apart two colours must be to count (pixelmatch's YIQ distance, 0-1). Both sides render in the same browser,
// so the same picture gives the same pixels; 0.03 lets through a colour off by a few units (a different but equal
// way to mix a translucent colour) and catches a wrong shade, which pixelmatch's default (0.1) lets through.
export const THRESHOLD = 0.03

/** -> { pixels, width, height, png } ; png marks the differing pixels in red over a faded copy of A. */
export function imageDiff(a, b) {
  const A = PNG.sync.read(a)
  const B = PNG.sync.read(b)
  if (A.width !== B.width || A.height !== B.height)
    return { pixels: Math.max(A.width * A.height, B.width * B.height), width: A.width, height: A.height, png: null, size: true }
  const out = new PNG({ width: A.width, height: A.height })
  const pixels = pixelmatch(A.data, B.data, out.data, A.width, A.height, { threshold: THRESHOLD, includeAA: false, alpha: 0.2 })
  return { pixels, width: A.width, height: A.height, png: pixels ? PNG.sync.write(out) : null }
}

/** The bounding boxes of the differing areas (in image pixels), merged on a coarse grid; at most 12. */
export function diffBoxes(diffPng, cell = 24) {
  if (!diffPng) return []
  const P = PNG.sync.read(diffPng)
  const cols = Math.ceil(P.width / cell)
  const rows = Math.ceil(P.height / cell)
  const hit = new Uint8Array(cols * rows)
  for (let y = 0; y < P.height; y++)
    for (let x = 0; x < P.width; x++) {
      const i = (y * P.width + x) * 4
      if (P.data[i] === 255 && P.data[i + 1] === 0 && P.data[i + 2] === 0) hit[Math.floor(y / cell) * cols + Math.floor(x / cell)] = 1
    }
  const seen = new Uint8Array(cols * rows)
  const boxes = []
  for (let k = 0; k < hit.length; k++) {
    if (!hit[k] || seen[k]) continue
    let [x0, y0, x1, y1] = [k % cols, Math.floor(k / cols), k % cols, Math.floor(k / cols)]
    const stack = [k]
    seen[k] = 1
    while (stack.length) {
      const c = stack.pop()
      const cx = c % cols
      const cy = Math.floor(c / cols)
      x0 = Math.min(x0, cx), y0 = Math.min(y0, cy), x1 = Math.max(x1, cx), y1 = Math.max(y1, cy)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const n = ny * cols + nx
        if (hit[n] && !seen[n]) (seen[n] = 1), stack.push(n)
      }
    }
    boxes.push({ x: x0 * cell, y: y0 * cell, w: (x1 - x0 + 1) * cell, h: (y1 - y0 + 1) * cell })
  }
  return boxes.sort((p, q) => q.w * q.h - p.w * p.h).slice(0, 12)
}

/** A line diff of two texts: [{ op: ' ' | '-' | '+', line }], unchanged runs longer than 2*ctx cut to "...". */
export function textDiff(a, b, ctx = 2) {
  if (a === b) return []
  const A = a.split('\n')
  const B = b.split('\n')
  // common head and tail first: most diffs are small, and the LCS table stays small
  let h = 0
  while (h < A.length && h < B.length && A[h] === B[h]) h++
  let t = 0
  while (t < A.length - h && t < B.length - h && A[A.length - 1 - t] === B[B.length - 1 - t]) t++
  const a2 = A.slice(h, A.length - t)
  const b2 = B.slice(h, B.length - t)
  let mid
  if (a2.length * b2.length > 4e6) mid = [...a2.map((line) => ({ op: '-', line })), ...b2.map((line) => ({ op: '+', line }))]
  else {
    const n = a2.length
    const m = b2.length
    const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    mid = []
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (a2[i] === b2[j]) mid.push({ op: ' ', line: a2[i] }), i++, j++
      else if (L[i + 1][j] >= L[i][j + 1]) mid.push({ op: '-', line: a2[i++] })
      else mid.push({ op: '+', line: b2[j++] })
    }
    while (i < n) mid.push({ op: '-', line: a2[i++] })
    while (j < m) mid.push({ op: '+', line: b2[j++] })
  }
  const all = [...A.slice(0, h).map((line) => ({ op: ' ', line })), ...mid, ...A.slice(A.length - t).map((line) => ({ op: ' ', line }))]
  const keep = all.map((x, k) => x.op !== ' ' || all.slice(Math.max(0, k - ctx), k + ctx + 1).some((y) => y.op !== ' '))
  const out = []
  for (let k = 0; k < all.length; k++) {
    if (keep[k]) out.push(all[k])
    else if (out.length === 0 || out[out.length - 1].op !== '…') out.push({ op: '…', line: '' })
  }
  return out
}

// ---------------------------------------------------------------- the film of a step
// A screen the user can see stays at least SEEN ms; shorter frames are the inside of an animation. The screens of
// the two sides are lined up in order (equal pictures match); a screen on one side with no match on the other is a
// difference: something shown that the other never shows, or shown in another order.
export const SEEN = 120
const sameImage = (a, b) => a.equals(b) || imageDiff(a, b).pixels === 0

/** films: [{ png, ms }] per side -> { diff, rows, a, b, short }; a/b list the seen screens: { i, ms, match }. */
export function filmDiff(fa, fb, [prevA, prevB] = []) {
  const seen = (f) => f.map((x, i) => ({ i, ms: x.ms })).filter((x) => x.ms >= SEEN)
  const a = seen(fa)
  const b = seen(fb)
  const n = a.length
  const m = b.length
  const eq = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => sameImage(fa[a[i].i].png, fb[b[j].i].png)))
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = eq[i][j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq[i][j]) (a[i].match = j), (b[j].match = i), i++, j++
    else if (L[i + 1][j] >= L[i][j + 1]) i++
    else j++
  }
  // a screen left over on one side counts only when the other side never painted it at all: one that the other
  // showed too, only for less time (a network answer a little later), is the same screen
  // (the screen before the step counts as painted on both: one side's film may start a frame later)
  const anywhere = (png, film, prev) => (prev && sameImage(png, prev)) || film.some((x) => sameImage(png, x.png))
  for (const x of a) if (x.match === undefined) x.briefly = anywhere(fa[x.i].png, fb, prevB)
  for (const x of b) if (x.match === undefined) x.briefly = anywhere(fb[x.i].png, fa, prevA)
  const rows = [
    ...a.filter((x) => x.match === undefined && !x.briefly).map((x) => `A 有、B 从没出现的画面（A 上停了 ${x.ms} ms）`),
    ...b.filter((x) => x.match === undefined && !x.briefly).map((x) => `B 有、A 从没出现的画面（B 上停了 ${x.ms} ms）`),
  ]
  // frames under SEEN on one side only, for the record (a flash): not counted, listed
  const short = { a: fa.filter((x) => x.ms < SEEN).length, b: fb.filter((x) => x.ms < SEEN).length }
  return { diff: rows.length > 0, rows, a, b, short }
}
