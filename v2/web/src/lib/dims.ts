// F353: each picture's width and height, from Taska, so a picture in a text keeps its place before it loads and the
// words around it do not jump. Asked for when a project opens, and again when a text shows a picture not known yet.
import { net } from './data'
import { ctx, render } from './state'

export const DIMS = new Map<string, [number, number]>()
const ASK = { at: 0, timer: 0, gen: 0 }

export async function loadDims() {
  const gen = ++ASK.gen,
    here = ctx.P
  ASK.at = Date.now()
  try {
    const d = await net<Record<string, [number, number]>>(here + 'api/dims')
    if (gen !== ASK.gen || here !== ctx.P) return
    const fresh = Object.keys(d).some((k) => !DIMS.has(k))
    for (const [k, v] of Object.entries(d)) DIMS.set(k, v)
    if (fresh) render()
  } catch {
    /* without sizes pictures load as before */
  }
}
/** A text shows a picture whose size is not known yet (one just uploaded): ask again, at most every few seconds. */
export function wantDims() {
  if (ASK.timer) return
  ASK.timer = window.setTimeout(
    () => {
      ASK.timer = 0
      void loadDims()
    },
    Math.max(300, 5000 - (Date.now() - ASK.at)),
  )
}
